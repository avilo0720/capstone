<?php

namespace App\Http\Controllers;

use App\Models\ProcurementRequest;
use App\Models\ProcurementRequestDocument;
use App\Services\ActivityLogger;
use App\Support\InventoryContext;
use App\Support\RolePermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ProcurementDocumentController extends Controller
{
    private const MIME_TYPES = [
        'pdf' => 'application/pdf',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'webp' => 'image/webp',
        'doc' => 'application/msword',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls' => 'application/vnd.ms-excel',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    public function __construct(private ActivityLogger $activity)
    {
    }

    public function store(Request $request, int $id): JsonResponse
    {
        $procurement = $this->findForInventory($request, $id);
        $user = $request->session()->get('user');

        if (!self::canManage($user, $procurement)) {
            return response()->json(['error' => 'Only people involved in this request can add documents.'], 403);
        }

        $extensions = implode(',', ProcurementRequestDocument::EXTENSIONS);
        $request->validate([
            'files' => ['required', 'array', 'min:1', 'max:5'],
            'files.*' => ['file', 'max:'.ProcurementRequestDocument::MAX_KILOBYTES, 'extensions:'.$extensions],
        ], [
            'files.*.max' => 'Each document must be 10 MB or smaller.',
            'files.*.extensions' => 'Documents must be PDF, image (PNG, JPG, WebP), Word, or Excel files.',
            'files.*.file' => 'One of the documents could not be uploaded.',
        ]);

        /** @var UploadedFile[] $files */
        $files = $request->file('files');
        $existing = $procurement->documents()->count();
        if ($existing + count($files) > ProcurementRequestDocument::MAX_PER_REQUEST) {
            return response()->json([
                'error' => 'A request can have at most '.ProcurementRequestDocument::MAX_PER_REQUEST.' documents.',
            ], 422);
        }

        $directory = storage_path('app'.DIRECTORY_SEPARATOR.ProcurementRequestDocument::DIRECTORY);
        if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
            return response()->json(['error' => 'Could not save documents.'], 500);
        }

        $saved = [];
        foreach ($files as $file) {
            $ext = strtolower($file->getClientOriginalExtension());
            $storedName = 'doc_'.$procurement->id.'_'.time().'_'.Str::lower(Str::random(10)).'.'.$ext;
            $size = (int) $file->getSize();
            $file->move($directory, $storedName);

            $saved[] = ProcurementRequestDocument::create([
                'procurement_request_id' => $procurement->id,
                'original_name' => Str::limit($this->cleanName($file->getClientOriginalName()), 250, ''),
                'stored_name' => $storedName,
                'mime_type' => self::MIME_TYPES[$ext] ?? 'application/octet-stream',
                'size' => $size,
                'uploaded_by' => $user['id'] ?? null,
            ]);
        }

        $names = array_map(fn (ProcurementRequestDocument $doc) => $doc->original_name, $saved);
        $this->activity->log(
            $request,
            'procurement_document_added',
            'Added '.count($saved).' document'.(count($saved) === 1 ? '' : 's').' to '
                .($procurement->rs_number ?: 'procurement request #'.$procurement->id)
                .': '.implode(', ', $names),
            'procurement_request',
            (int) $procurement->id,
            ['documents' => $names]
        );

        return response()->json([
            'success' => true,
            'documents' => self::serializeAll($user, $procurement->fresh('documents.uploader')),
        ], 201);
    }

    public function show(Request $request, int $id, int $documentId): BinaryFileResponse
    {
        $procurement = $this->findForInventory($request, $id);
        $document = $procurement->documents()->find($documentId);
        if (!$document || !is_file($document->path())) {
            abort(404, 'Document not found.');
        }

        $headers = [
            'Content-Type' => self::MIME_TYPES[$document->extension()] ?? 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff',
        ];

        if ($document->opensInline()) {
            return response()->file($document->path(), $headers + [
                'Content-Disposition' => 'inline; filename="'.addcslashes($this->asciiName($document->original_name), '"\\').'"',
            ]);
        }

        return response()->download($document->path(), $document->original_name, $headers);
    }

    public function destroy(Request $request, int $id, int $documentId): JsonResponse
    {
        $procurement = $this->findForInventory($request, $id);
        $user = $request->session()->get('user');
        $document = $procurement->documents()->find($documentId);
        if (!$document) {
            return response()->json(['error' => 'Document not found.'], 404);
        }

        if (!self::canDelete($user, $document)) {
            return response()->json(['error' => 'You can only remove documents you uploaded.'], 403);
        }

        self::deleteDocument($document);

        $this->activity->log(
            $request,
            'procurement_document_removed',
            'Removed document '.$document->original_name.' from '
                .($procurement->rs_number ?: 'procurement request #'.$procurement->id),
            'procurement_request',
            (int) $procurement->id,
            ['documents' => [$document->original_name]]
        );

        return response()->json([
            'success' => true,
            'documents' => self::serializeAll($user, $procurement->fresh('documents.uploader')),
        ]);
    }

    /** Requester, current assignee, anyone who signed a step, or an admin. */
    public static function canManage(?array $user, ProcurementRequest $row): bool
    {
        if (RolePermissions::canManageUsers($user)) {
            return true;
        }

        $userId = (int) ($user['id'] ?? 0);
        if ($userId <= 0) {
            return false;
        }

        foreach (['uploaded_by', 'assigned_to', 'noted_by', 'checked_by', 'approved_by'] as $column) {
            if ((int) ($row->{$column} ?? 0) === $userId) {
                return true;
            }
        }

        return false;
    }

    public static function canDelete(?array $user, ProcurementRequestDocument $document): bool
    {
        if (RolePermissions::canManageUsers($user)) {
            return true;
        }

        $userId = (int) ($user['id'] ?? 0);

        return $userId > 0 && (int) ($document->uploaded_by ?? 0) === $userId;
    }

    public static function serializeAll(?array $user, ProcurementRequest $row): array
    {
        return $row->documents->map(fn (ProcurementRequestDocument $doc) => [
            'id' => $doc->id,
            'name' => $doc->original_name,
            'extension' => $doc->extension(),
            'size' => $doc->size,
            'is_image' => $doc->isImage(),
            'url' => $doc->url(),
            'uploaded_by' => $doc->uploader?->full_name,
            'created_at' => $doc->created_at?->toIso8601String(),
            'can_delete' => self::canDelete($user, $doc),
        ])->values()->all();
    }

    public static function deleteDocument(ProcurementRequestDocument $document): void
    {
        if (is_file($document->path())) {
            @unlink($document->path());
        }
        $document->delete();
    }

    private function findForInventory(Request $request, int $id): ProcurementRequest
    {
        $procurement = ProcurementRequest::query()
            ->where('inventory_id', InventoryContext::currentId($request))
            ->find($id);

        if (!$procurement) {
            abort(response()->json(['error' => 'Procurement request not found.'], 404));
        }

        return $procurement;
    }

    private function cleanName(string $name): string
    {
        $name = trim(preg_replace('/[\x00-\x1F\x7F\/\\\\]+/u', ' ', $name) ?? '');

        return $name !== '' ? $name : 'document';
    }

    private function asciiName(string $name): string
    {
        return Str::ascii($name) ?: 'document';
    }
}
