<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Item;
use App\Models\ProcurementRequest;
use App\Models\ProcurementRequestItem;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\ProcurementFileParser;
use App\Services\ProcurementStockService;
use App\Support\ActivityChangeSet;
use App\Support\InventoryContext;
use App\Support\RolePermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use InvalidArgumentException;

class ProcurementController extends Controller
{
    public function __construct(
        private ActivityLogger $activity,
        private ProcurementFileParser $parser,
        private ProcurementStockService $stock,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $inventoryId = InventoryContext::currentId($request);
        if (!$inventoryId) {
            return response()->json(['requests' => []]);
        }

        $status = $request->query('status');
        $query = ProcurementRequest::query()
            ->with($this->detailRelations())
            ->where('inventory_id', $inventoryId)
            ->orderByDesc('id');

        if (is_string($status) && $status !== '' && $status !== 'all') {
            $query->where('status', $status);
        }

        $rows = $query->get()->map(fn (ProcurementRequest $row) => $this->serialize($request, $row, false));

        return response()->json(['requests' => $rows]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $procurement = $this->findForInventory($request, $id);

        return response()->json(['request' => $this->serialize($request, $procurement, true)]);
    }

    public function history(Request $request, int $id): JsonResponse
    {
        $procurement = $this->findForInventory($request, $id);

        $logs = ActivityLog::query()
            ->with('user:id,first_name,last_name,username,role')
            ->where('entity_type', 'procurement_request')
            ->where('entity_id', $procurement->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(function (ActivityLog $log) {
                $user = $log->user;

                return [
                    'id' => $log->id,
                    'action' => $log->action,
                    'description' => $log->description,
                    'meta' => $log->meta,
                    'created_at' => $log->created_at?->toIso8601String(),
                    'user' => $user ? [
                        'id' => $user->id,
                        'full_name' => trim($user->first_name.' '.$user->last_name),
                        'username' => $user->username,
                        'role' => $user->role,
                    ] : [
                        'id' => null,
                        'full_name' => 'Unknown user',
                        'username' => null,
                        'role' => null,
                    ],
                ];
            })
            ->values();

        return response()->json([
            'request_id' => $procurement->id,
            'rs_number' => $procurement->rs_number,
            'events' => $logs,
        ]);
    }

    public function assignees(Request $request): JsonResponse
    {
        $users = User::query()
            ->with('department:id,name')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'first_name', 'last_name', 'username', 'role', 'department_id'])
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->full_name,
                'role' => $user->role,
                'department' => $user->department?->name,
            ])
            ->values();

        return response()->json(['users' => $users]);
    }

    public function store(Request $request): JsonResponse
    {
        if (!RolePermissions::canEditProcurement($request->session()->get('user'))) {
            return response()->json(['error' => 'You cannot submit procurement requests.'], 403);
        }

        $data = $request->validate([
            'original_filename' => ['nullable', 'string', 'max:255'],
            'amc_mode' => ['nullable', 'string', 'max:40'],
            'source' => ['nullable', 'string', Rule::in(['forecast', 'manual'])],
            'destination' => ['nullable', 'string', 'max:120'],
            'purpose' => ['nullable', 'string', 'max:2000'],
            'date_needed' => ['nullable', 'date'],
            'assigned_to' => ['required', 'integer', 'exists:users,id'],
            'signature' => ['required', 'string', 'min:64', 'max:900000'],
            'attachment' => ['nullable', 'string', 'min:64', 'max:3500000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.item_id' => ['nullable', 'integer'],
            'items.*.item_code' => ['nullable', 'string', 'max:80'],
            'items.*.title' => ['required', 'string', 'max:255'],
            'items.*.size' => ['nullable', 'string', 'max:80'],
            'items.*.current_qty' => ['nullable', 'numeric'],
            'items.*.amc' => ['nullable', 'numeric'],
            'items.*.need_3m' => ['nullable', 'numeric'],
            'items.*.need_6m' => ['nullable', 'numeric'],
            'items.*.need_1y' => ['nullable', 'numeric'],
            'items.*.method' => ['nullable', 'string', 'max:80'],
            'items.*.requested_qty' => ['nullable', 'numeric'],
        ]);

        $inventoryId = InventoryContext::currentId($request);
        if (!$inventoryId) {
            return response()->json(['error' => 'No inventory selected.'], 422);
        }

        $source = $data['source'] ?? 'forecast';
        $defaultName = $source === 'manual' ? 'Manual entry' : 'Forecast send';

        try {
            $signature = $this->storeSignatureDataUrl($data['signature'], 'requested');
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        $attachment = null;
        if (!empty($data['attachment'])) {
            try {
                $attachment = $this->storeAttachmentDataUrl($data['attachment']);
            } catch (InvalidArgumentException $e) {
                $this->deleteSignatureFile($signature);

                return response()->json(['error' => $e->getMessage()], 422);
            }
        }

        $procurement = $this->createRequest(
            $request,
            $inventoryId,
            $source,
            $data['original_filename'] ?? $defaultName,
            $data['amc_mode'] ?? null,
            $data['items'],
            [
                'destination' => $data['destination'] ?? null,
                'purpose' => $data['purpose'] ?? null,
                'date_needed' => $data['date_needed'] ?? null,
                'assigned_to' => (int) $data['assigned_to'],
                'requested_signature' => $signature,
                'attachment_image' => $attachment,
            ]
        );

        return response()->json([
            'success' => true,
            'request' => $this->serialize($request, $procurement, true),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (!RolePermissions::canEditProcurement($request->session()->get('user'))) {
            return response()->json(['error' => 'You cannot edit this request.'], 403);
        }

        $procurement = $this->findForInventory($request, $id);
        if (!$procurement->isDenied()) {
            return response()->json(['error' => 'Only denied requests can be edited.'], 422);
        }

        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'integer'],
            'items.*.requested_qty' => ['required', 'integer', 'min:0'],
        ]);

        $allowedIds = $procurement->items->pluck('id')->all();
        $before = $procurement->items->mapWithKeys(
            fn (ProcurementRequestItem $line) => [$line->id => (int) $line->requested_qty]
        )->all();

        foreach ($data['items'] as $row) {
            if (!in_array((int) $row['id'], $allowedIds, true)) {
                return response()->json(['error' => 'One of the lines does not belong to this request.'], 422);
            }
        }

        foreach ($data['items'] as $row) {
            ProcurementRequestItem::where('id', $row['id'])
                ->where('procurement_request_id', $procurement->id)
                ->update(['requested_qty' => (int) $row['requested_qty']]);
        }

        $procurement->refresh()->load('items');
        $after = $procurement->items->mapWithKeys(
            fn (ProcurementRequestItem $line) => [$line->id => (int) $line->requested_qty]
        )->all();

        $this->activity->log(
            $request,
            'procurement_edited',
            'Edited denied procurement request #'.$procurement->id,
            'procurement_request',
            (int) $procurement->id,
            [
                'changes' => ActivityChangeSet::diff(
                    ['qtys' => json_encode($before)],
                    ['qtys' => json_encode($after)],
                    ['qtys' => 'Requested quantities']
                ),
            ]
        );

        return response()->json([
            'success' => true,
            'request' => $this->serialize($request, $procurement, true),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->session()->get('user');
        $procurement = $this->findForInventory($request, $id);

        if (!RolePermissions::canDeleteProcurementRequest($user, $procurement->uploaded_by !== null ? (int) $procurement->uploaded_by : null)) {
            return response()->json(['error' => 'You can only delete your own requests.'], 403);
        }

        if (!$procurement->isPending() && !$procurement->isDenied()) {
            return response()->json(['error' => 'Completed requests cannot be deleted.'], 422);
        }

        $label = ($procurement->rs_number ?: 'procurement request #'.$procurement->id);
        $procurement->items()->delete();
        foreach ([
            $procurement->requested_signature,
            $procurement->noted_signature,
            $procurement->checked_signature,
            $procurement->approved_signature,
        ] as $signatureFile) {
            $this->deleteSignatureFile($signatureFile);
        }
        $this->deleteAttachmentFile($procurement->attachment_image);
        $procurement->delete();

        $this->activity->log(
            $request,
            'procurement_deleted',
            'Deleted '.$label.' (RS number returned to pool)',
            'procurement_request',
            $id
        );

        return response()->json(['success' => true]);
    }

    public function approve(Request $request, int $id): JsonResponse
    {
        return $this->advance($request, $id);
    }

    public function advance(Request $request, int $id): JsonResponse
    {
        $user = $request->session()->get('user');
        $procurement = $this->findForInventory($request, $id);
        $step = $procurement->currentStep();

        if (!$this->canActOnRequest($user, $procurement)) {
            return response()->json(['error' => 'Only the person assigned this step can act on it.'], 403);
        }

        $data = $request->validate([
            'assigned_to' => ['required', 'integer', 'exists:users,id'],
            'signature' => ['required', 'string', 'min:64', 'max:900000'],
        ]);

        $nextAssignee = (int) $data['assigned_to'];
        $nextStatus = $procurement->nextStatus();
        if (!$nextStatus) {
            return response()->json(['error' => 'This request is not waiting for approval.'], 422);
        }

        try {
            $signatureFile = $this->storeSignatureDataUrl($data['signature'], (string) $step);
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        $previousStatus = $procurement->status;
        $now = now();
        $userId = $user['id'] ?? null;
        $payload = [
            'status' => $nextStatus,
            'assigned_to' => $nextAssignee,
            'reviewed_by' => $userId,
            'reviewed_at' => $now,
            'rejection_reason' => null,
        ];

        $action = 'procurement_approved';
        $description = 'Advanced procurement request #'.$procurement->id;

        if ($step === ProcurementRequest::STEP_DEPT) {
            $this->deleteSignatureFile($procurement->noted_signature);
            $payload['noted_by'] = $userId;
            $payload['noted_at'] = $now;
            $payload['noted_signature'] = $signatureFile;
            $action = 'procurement_dept_noted';
            $description = 'Department head noted request slip #'.$procurement->id;
        } elseif ($step === ProcurementRequest::STEP_CHECK) {
            $this->deleteSignatureFile($procurement->checked_signature);
            $payload['checked_by'] = $userId;
            $payload['checked_at'] = $now;
            $payload['checked_signature'] = $signatureFile;
            $action = 'procurement_checked';
            $description = 'Procurement checked request slip #'.$procurement->id;
        } else {
            $this->deleteSignatureFile($procurement->approved_signature);
            $payload['approved_by'] = $userId;
            $payload['approved_at'] = $now;
            $payload['approved_signature'] = $signatureFile;
            $action = 'procurement_approved';
            $description = 'Branch manager approved request slip #'.$procurement->id;
        }

        $procurement->update($payload);

        $this->activity->log(
            $request,
            $action,
            $description,
            'procurement_request',
            (int) $procurement->id,
            [
                'changes' => ActivityChangeSet::diff(
                    ['status' => $previousStatus],
                    ['status' => $nextStatus],
                    ['status' => 'Status']
                ),
            ]
        );

        return response()->json([
            'success' => true,
            'request' => $this->serialize($request, $this->findForInventory($request, $id), true),
        ]);
    }

    public function deny(Request $request, int $id): JsonResponse
    {
        $user = $request->session()->get('user');
        $procurement = $this->findForInventory($request, $id);

        if (!$this->canActOnRequest($user, $procurement)) {
            return response()->json(['error' => 'Only the person assigned this step can deny it.'], 403);
        }

        $data = $request->validate([
            'reason' => ['required', 'string', 'min:3', 'max:2000'],
        ]);

        if (!$procurement->isInWorkflow()) {
            return response()->json(['error' => 'Only in-process request slips can be denied.'], 422);
        }

        $reason = trim($data['reason']);
        $sessionUser = $request->session()->get('user');
        $freedRs = $procurement->rs_number;

        $procurement->update([
            'status' => ProcurementRequest::STATUS_DENIED,
            'rejection_reason' => $reason,
            'reviewed_by' => $sessionUser['id'] ?? null,
            'reviewed_at' => now(),
            // Free the RS sequence so a new / resubmitted slip can reuse it.
            'rs_number' => null,
        ]);

        $this->activity->log(
            $request,
            'procurement_denied',
            'Denied procurement request #'.$procurement->id
                .($freedRs ? ' (released '.$freedRs.')' : ''),
            'procurement_request',
            (int) $procurement->id,
            [
                'changes' => ActivityChangeSet::snapshot(
                    ['reason' => $reason, 'rs_number' => $freedRs],
                    ['reason' => 'Rejection reason', 'rs_number' => 'RS number']
                ),
            ]
        );

        return response()->json([
            'success' => true,
            'request' => $this->serialize($request, $this->findForInventory($request, $id), true),
        ]);
    }

    public function stockEntry(Request $request, int $id): JsonResponse
    {
        $user = $request->session()->get('user');
        $procurement = $this->findForInventory($request, $id);

        if (!$this->canHandleApprovedRequest($user, $procurement)) {
            return response()->json(['error' => 'Only procurement can enter stock after approval.'], 403);
        }

        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'integer'],
            'items.*.qty' => ['required', 'integer', 'min:0'],
        ]);

        $allowedIds = $procurement->items()->pluck('id')->all();
        $qtyByLineId = [];

        foreach ($data['items'] as $row) {
            $lineId = (int) $row['id'];
            if (!in_array($lineId, $allowedIds, true)) {
                return response()->json(['error' => 'One of the lines does not belong to this request.'], 422);
            }
            $qtyByLineId[$lineId] = (int) $row['qty'];
        }

        try {
            $this->stock->apply(
                $request,
                $procurement->load('items'),
                $qtyByLineId,
                ProcurementRequest::STATUS_STOCK_ENTERED,
                'procurement_stock_entered',
                'Entered received stock for procurement request #'.$procurement->id
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json([
            'success' => true,
            'request' => $this->serialize($request, $this->findForInventory($request, $id), true),
        ]);
    }

    public function resubmit(Request $request, int $id): JsonResponse
    {
        if (!RolePermissions::canEditProcurement($request->session()->get('user'))) {
            return response()->json(['error' => 'You cannot resubmit this request.'], 403);
        }

        $procurement = $this->findForInventory($request, $id);
        if (!$procurement->isDenied()) {
            return response()->json(['error' => 'Only denied requests can be returned to pending.'], 422);
        }

        $data = $request->validate([
            'assigned_to' => ['required', 'integer', 'exists:users,id'],
            'signature' => ['required', 'string', 'min:64', 'max:900000'],
        ]);

        if (!trim((string) $procurement->rejection_reason)) {
            return response()->json(['error' => 'A manager rejection reason must be on file before resubmitting.'], 422);
        }

        try {
            $signature = $this->storeSignatureDataUrl($data['signature'], 'requested');
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        $previous = $procurement->rejection_reason;

        $this->deleteSignatureFile($procurement->requested_signature);
        $this->deleteSignatureFile($procurement->noted_signature);
        $this->deleteSignatureFile($procurement->checked_signature);
        $this->deleteSignatureFile($procurement->approved_signature);

        DB::transaction(function () use ($procurement, $data, $previous, $signature) {
            $rsNumber = ProcurementRequest::allocateRsNumber(now());

            $procurement->update([
                'status' => ProcurementRequest::STATUS_PENDING,
                'rs_number' => $rsNumber,
                'assigned_to' => (int) $data['assigned_to'],
                'previous_rejection_reason' => $previous,
                'rejection_reason' => null,
                'reviewed_by' => null,
                'reviewed_at' => null,
                'noted_by' => null,
                'noted_at' => null,
                'noted_signature' => null,
                'checked_by' => null,
                'checked_at' => null,
                'checked_signature' => null,
                'approved_by' => null,
                'approved_at' => null,
                'approved_signature' => null,
                'printed_at' => null,
                'requested_signature' => $signature,
            ]);
        });

        $procurement->refresh();

        $this->activity->log(
            $request,
            'procurement_resubmitted',
            'Resubmitted procurement request #'.$procurement->id
                .' to pending as '.($procurement->rs_number ?: 'pending'),
            'procurement_request',
            (int) $procurement->id,
            [
                'changes' => ActivityChangeSet::diff(
                    ['status' => ProcurementRequest::STATUS_DENIED],
                    ['status' => ProcurementRequest::STATUS_PENDING],
                    ['status' => 'Status']
                ),
            ]
        );

        return response()->json([
            'success' => true,
            'request' => $this->serialize($request, $this->findForInventory($request, $id), true),
        ]);
    }

    public function slip(Request $request, int $id)
    {
        $user = $request->session()->get('user');
        $procurement = $this->findForInventory($request, $id);

        if (!in_array($procurement->status, [
            ProcurementRequest::STATUS_APPROVED,
            ProcurementRequest::STATUS_STOCK_ENTERED,
        ], true)) {
            abort(422, 'Only branch-manager-approved request slips can be printed.');
        }

        if (!$this->canHandleApprovedRequest($user, $procurement)) {
            abort(403, 'Only the assigned procurement staff can print the approved RS slip.');
        }

        if (!$procurement->printed_at) {
            $procurement->update(['printed_at' => now()]);
            $this->activity->log(
                $request,
                'procurement_printed',
                'Printed RS slip '.$procurement->rs_number,
                'procurement_request',
                (int) $procurement->id
            );
        }

        $slip = $this->findForInventory($request, $id);
        $slip->loadMissing('items.catalogItem');

        $lines = $slip->items->map(function ($line) {
            $price = (float) ($line->catalogItem?->price ?? 0);
            $qty = (int) $line->requested_qty;

            return [
                'qty' => $qty,
                'unit' => $line->size ?: '',
                'particulars' => trim(implode(' ', array_filter([
                    $line->title,
                    $line->item_code ? '('.$line->item_code.')' : null,
                ]))),
                'price' => $price,
                'total' => $price * $qty,
            ];
        });

        return view('procurement-slip', [
            'title' => 'RS '.$slip->rs_number,
            'request' => $slip,
            'lines' => $lines,
            'grandTotal' => $lines->sum('total'),
            'blankRows' => max(0, 16 - max(1, $lines->count())),
            'signatures' => [
                'requested' => $slip->signatureUrl($slip->requested_signature),
                'noted' => $slip->signatureUrl($slip->noted_signature),
                'checked' => $slip->signatureUrl($slip->checked_signature),
                'approved' => $slip->signatureUrl($slip->approved_signature),
            ],
            'attachmentUrl' => $slip->attachmentUrl(),
        ]);
    }

    private function createRequest(
        Request $request,
        int $inventoryId,
        string $source,
        ?string $filename,
        ?string $amcMode,
        array $rows,
        array $extras = [],
    ): ProcurementRequest {
        $sessionUser = $request->session()->get('user');
        $catalog = Item::query()->where('inventory_id', $inventoryId)->get();

        $procurement = DB::transaction(function () use (
            $inventoryId,
            $source,
            $filename,
            $amcMode,
            $rows,
            $sessionUser,
            $catalog,
            $extras
        ) {
            $created = ProcurementRequest::create([
                'inventory_id' => $inventoryId,
                'department_id' => $sessionUser['departmentId'] ?? null,
                'status' => ProcurementRequest::STATUS_PENDING,
                'source' => $source,
                'original_filename' => $filename,
                'amc_mode' => $amcMode,
                'destination' => $extras['destination'] ?? null,
                'purpose' => $extras['purpose'] ?? ($source === 'forecast' ? 'Forecast replenishment' : null),
                'date_needed' => $extras['date_needed'] ?? null,
                'uploaded_by' => $sessionUser['id'] ?? null,
                'assigned_to' => $extras['assigned_to'] ?? null,
                'requested_signature' => $extras['requested_signature'] ?? null,
                'attachment_image' => $extras['attachment_image'] ?? null,
            ]);
            $created->update([
                'rs_number' => ProcurementRequest::allocateRsNumber($created->created_at),
            ]);

            foreach ($rows as $row) {
                $matched = $this->matchItem($catalog, $row);

                $need3m = $this->parser->parseNeed($row['need_3m'] ?? 0);
                $requested = array_key_exists('requested_qty', $row)
                    ? $this->parser->parseNeed($row['requested_qty'])
                    : $need3m;

                ProcurementRequestItem::create([
                    'procurement_request_id' => $created->id,
                    'item_id' => $matched?->id,
                    'item_code' => $row['item_code'] ?? $matched?->itemCode,
                    'title' => $row['title'] ?? $matched?->title ?? 'Item',
                    'size' => $row['size'] ?? $matched?->size,
                    'current_qty' => $this->parser->parseNeed($row['current_qty'] ?? $matched?->quantity ?? 0),
                    'amc' => $this->parser->parseDecimal($row['amc'] ?? 0),
                    'need_3m' => $need3m,
                    'need_6m' => $this->parser->parseNeed($row['need_6m'] ?? 0),
                    'need_1y' => $this->parser->parseNeed($row['need_1y'] ?? 0),
                    'method' => $row['method'] ?? null,
                    'requested_qty' => $requested,
                ]);
            }

            return $created;
        });

        $sourceLabel = match ($source) {
            'forecast' => 'Sent forecast to procurement',
            'manual' => 'Created manual procurement request',
            default => 'Uploaded procurement file',
        };

        $this->activity->log(
            $request,
            'procurement_submitted',
            $sourceLabel
                .' as request slip '.($procurement->rs_number ?: '#'.$procurement->id)
                .($filename ? ' ('.$filename.')' : ''),
            'procurement_request',
            (int) $procurement->id,
            [
                'source' => $source,
                'filename' => $filename,
                'line_count' => count($rows),
            ]
        );

        return $this->findForInventory($request, (int) $procurement->id);
    }

    private function matchItem($catalog, array $row): ?Item
    {
        $itemId = (int) ($row['item_id'] ?? 0);
        if ($itemId > 0) {
            $match = $catalog->firstWhere('id', $itemId);
            if ($match) {
                return $match;
            }
        }

        $code = strtolower(trim((string) ($row['item_code'] ?? '')));
        if ($code !== '') {
            $match = $catalog->first(function (Item $item) use ($code) {
                return strtolower(trim((string) $item->itemCode)) === $code;
            });
            if ($match) {
                return $match;
            }
        }

        $title = strtolower(trim((string) ($row['title'] ?? '')));
        $size = strtolower(trim((string) ($row['size'] ?? '')));
        if ($title === '') {
            return null;
        }

        return $catalog->first(function (Item $item) use ($title, $size) {
            return strtolower(trim((string) $item->title)) === $title
                && strtolower(trim((string) $item->size)) === $size;
        });
    }

    private function storeSignatureDataUrl(string $dataUrl, string $role): string
    {
        if (!preg_match('#^data:image/(png|jpeg|jpg|webp);base64,#i', $dataUrl, $matches)) {
            throw new InvalidArgumentException('Signature must be a drawn or uploaded image.');
        }

        $encoded = substr($dataUrl, strpos($dataUrl, ',') + 1);
        $binary = base64_decode($encoded, true);
        if ($binary === false || strlen($binary) < 80) {
            throw new InvalidArgumentException('Signature image is empty or invalid.');
        }
        if (strlen($binary) > 700000) {
            throw new InvalidArgumentException('Signature image is too large. Use a smaller drawing or photo.');
        }

        $ext = strtolower($matches[1]);
        if ($ext === 'jpeg') {
            $ext = 'jpg';
        }

        $directory = public_path('uploads/procurement-signatures');
        if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
            throw new InvalidArgumentException('Could not save signature file.');
        }

        $filename = 'sig_'.$role.'_'.time().'_'.Str::lower(Str::random(6)).'.'.$ext;
        if (file_put_contents($directory.DIRECTORY_SEPARATOR.$filename, $binary) === false) {
            throw new InvalidArgumentException('Could not save signature file.');
        }

        return $filename;
    }

    private function deleteSignatureFile(?string $filename): void
    {
        if (!$filename) {
            return;
        }

        $path = public_path('uploads/procurement-signatures/'.$filename);
        if (is_file($path)) {
            @unlink($path);
        }
    }

    private function storeAttachmentDataUrl(string $dataUrl): string
    {
        if (!preg_match('#^data:image/(png|jpeg|jpg|webp);base64,#i', $dataUrl, $matches)) {
            throw new InvalidArgumentException('Attachment must be a PNG, JPG, or WebP image.');
        }

        $encoded = substr($dataUrl, strpos($dataUrl, ',') + 1);
        $binary = base64_decode($encoded, true);
        if ($binary === false || strlen($binary) < 80) {
            throw new InvalidArgumentException('Attachment image is empty or invalid.');
        }
        if (strlen($binary) > 2500000) {
            throw new InvalidArgumentException('Attachment image is too large. Use a file under about 2 MB.');
        }

        $ext = strtolower($matches[1]);
        if ($ext === 'jpeg') {
            $ext = 'jpg';
        }

        $directory = public_path('uploads/procurement-attachments');
        if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
            throw new InvalidArgumentException('Could not save attachment file.');
        }

        $filename = 'att_'.time().'_'.Str::lower(Str::random(6)).'.'.$ext;
        if (file_put_contents($directory.DIRECTORY_SEPARATOR.$filename, $binary) === false) {
            throw new InvalidArgumentException('Could not save attachment file.');
        }

        return $filename;
    }

    private function deleteAttachmentFile(?string $filename): void
    {
        if (!$filename) {
            return;
        }

        $path = public_path('uploads/procurement-attachments/'.$filename);
        if (is_file($path)) {
            @unlink($path);
        }
    }

    private function findForInventory(Request $request, int $id): ProcurementRequest
    {
        $inventoryId = InventoryContext::currentId($request);
        $procurement = ProcurementRequest::query()
            ->with($this->detailRelations())
            ->where('inventory_id', $inventoryId)
            ->find($id);

        if (!$procurement) {
            abort(response()->json(['error' => 'Procurement request not found.'], 404));
        }

        return $procurement;
    }

    private function detailRelations(): array
    {
        $userCols = 'id,first_name,last_name,username,role,department_id';

        return [
            'items',
            'department:id,name',
            'uploader:'.$userCols,
            'assignedToUser:'.$userCols,
            'reviewer:'.$userCols,
            'notedByUser:'.$userCols,
            'checkedByUser:'.$userCols,
            'approvedByUser:'.$userCols,
        ];
    }

    private function personPayload(?User $user): ?array
    {
        if (!$user) {
            return null;
        }

        return [
            'id' => $user->id,
            'name' => $user->full_name,
            'role' => $user->role,
        ];
    }

    private function canActOnRequest(?array $user, ProcurementRequest $row): bool
    {
        if (!$row->isInWorkflow()) {
            return false;
        }

        return RolePermissions::canActOnAssignedProcurement(
            $user,
            $row->assigned_to !== null ? (int) $row->assigned_to : null
        );
    }

    private function canHandleApprovedRequest(?array $user, ProcurementRequest $row): bool
    {
        if (!in_array($row->status, [
            ProcurementRequest::STATUS_APPROVED,
            ProcurementRequest::STATUS_STOCK_ENTERED,
        ], true)) {
            return false;
        }

        return RolePermissions::canPrintProcurementSlip(
            $user,
            $row->assigned_to !== null ? (int) $row->assigned_to : null,
            $row->checked_by !== null ? (int) $row->checked_by : null
        );
    }

    private function serialize(Request $request, ProcurementRequest $row, bool $withItems): array
    {
        $user = $request->session()->get('user');
        $payload = [
            'id' => $row->id,
            'rs_number' => $row->rs_number,
            'status' => $row->status,
            'current_step' => $row->currentStep(),
            'can_act' => $this->canActOnRequest($user, $row),
            'can_print' => $this->canHandleApprovedRequest($user, $row),
            'source' => $row->source,
            'original_filename' => $row->original_filename,
            'amc_mode' => $row->amc_mode,
            'destination' => $row->destination,
            'purpose' => $row->purpose,
            'date_needed' => $row->date_needed?->toDateString(),
            'department_name' => $row->department?->name,
            'rejection_reason' => $row->rejection_reason,
            'previous_rejection_reason' => $row->previous_rejection_reason,
            'stock_applied_at' => $row->stock_applied_at?->toIso8601String(),
            'reviewed_at' => $row->reviewed_at?->toIso8601String(),
            'noted_at' => $row->noted_at?->toIso8601String(),
            'checked_at' => $row->checked_at?->toIso8601String(),
            'approved_at' => $row->approved_at?->toIso8601String(),
            'printed_at' => $row->printed_at?->toIso8601String(),
            'created_at' => $row->created_at?->toIso8601String(),
            'updated_at' => $row->updated_at?->toIso8601String(),
            'line_count' => $row->items->count(),
            'total_requested' => (int) $row->items->sum('requested_qty'),
            'unmatched_count' => $row->items->whereNull('item_id')->count(),
            'uploaded_by_id' => $row->uploaded_by,
            'uploaded_by' => $row->uploader?->full_name,
            'assigned_to' => $this->personPayload($row->assignedToUser),
            'reviewed_by' => $row->reviewer?->full_name,
            'noted_by' => $this->personPayload($row->notedByUser),
            'checked_by' => $this->personPayload($row->checkedByUser),
            'approved_by' => $this->personPayload($row->approvedByUser),
            'attachment_url' => $row->attachmentUrl(),
        ];

        if ($withItems) {
            $payload['items'] = $row->items->map(fn (ProcurementRequestItem $line) => [
                'id' => $line->id,
                'item_id' => $line->item_id,
                'item_code' => $line->item_code,
                'title' => $line->title,
                'size' => $line->size,
                'current_qty' => (int) $line->current_qty,
                'amc' => (float) $line->amc,
                'need_3m' => (int) $line->need_3m,
                'need_6m' => (int) $line->need_6m,
                'need_1y' => (int) $line->need_1y,
                'method' => $line->method,
                'requested_qty' => (int) $line->requested_qty,
                'applied_qty' => $line->applied_qty,
                'matched' => $line->item_id !== null,
            ])->values();
        }

        return $payload;
    }
}
