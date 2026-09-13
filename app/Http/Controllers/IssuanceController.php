<?php

namespace App\Http\Controllers;

use App\Models\IssuanceRequest;
use App\Models\IssuanceRequestItem;
use App\Models\Item;
use App\Services\ActivityLogger;
use App\Services\IssuanceStockService;
use App\Services\ProcurementFileParser;
use App\Support\ActivityChangeSet;
use App\Support\InventoryContext;
use App\Support\RolePermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use InvalidArgumentException;

class IssuanceController extends Controller
{
    public function __construct(
        private ActivityLogger $activity,
        private ProcurementFileParser $parser,
        private IssuanceStockService $stock,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $inventoryId = InventoryContext::currentId($request);
        if (!$inventoryId) {
            return response()->json(['requests' => []]);
        }

        $status = $request->query('status');
        $query = IssuanceRequest::query()
            ->with(['items', 'uploader:id,first_name,last_name,username', 'reviewer:id,first_name,last_name,username'])
            ->where('inventory_id', $inventoryId)
            ->orderByDesc('id');

        if (is_string($status) && $status !== '' && $status !== 'all') {
            $query->where('status', $status);
        }

        $rows = $query->get()->map(fn (IssuanceRequest $row) => $this->serialize($row, false));

        return response()->json(['requests' => $rows]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $issuance = $this->findForInventory($request, $id);

        return response()->json(['request' => $this->serialize($issuance, true)]);
    }

    public function store(Request $request): JsonResponse
    {
        if (!RolePermissions::canEditIssuance($request->session()->get('user'))) {
            return response()->json(['error' => 'You cannot submit issuance requests.'], 403);
        }

        $data = $request->validate([
            'original_filename' => ['nullable', 'string', 'max:255'],
            'amc_mode' => ['nullable', 'string', 'max:40'],
            'source' => ['nullable', 'string', Rule::in(['forecast', 'manual'])],
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

        $issuance = $this->createRequest(
            $request,
            $inventoryId,
            $source,
            $data['original_filename'] ?? $defaultName,
            $data['amc_mode'] ?? null,
            $data['items']
        );

        return response()->json([
            'success' => true,
            'request' => $this->serialize($issuance, true),
        ], 201);
    }

    public function upload(Request $request): JsonResponse
    {
        if (!RolePermissions::canEditIssuance($request->session()->get('user'))) {
            return response()->json(['error' => 'You cannot upload issuance files.'], 403);
        }

        $request->validate([
            'file' => ['required', 'file', 'max:5120', 'mimes:xlsx,xls,csv,txt'],
            'amc_mode' => ['nullable', 'string', 'max:40'],
        ]);

        $inventoryId = InventoryContext::currentId($request);
        if (!$inventoryId) {
            return response()->json(['error' => 'No inventory selected.'], 422);
        }

        $file = $request->file('file');

        try {
            $rows = $this->parser->parse($file->getRealPath(), $file->getClientOriginalName());
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        $issuance = $this->createRequest(
            $request,
            $inventoryId,
            'upload',
            $file->getClientOriginalName(),
            $request->input('amc_mode'),
            $rows
        );

        return response()->json([
            'success' => true,
            'request' => $this->serialize($issuance, true),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (!RolePermissions::canEditIssuance($request->session()->get('user'))) {
            return response()->json(['error' => 'You cannot edit this request.'], 403);
        }

        $issuance = $this->findForInventory($request, $id);
        if (!$issuance->isDenied()) {
            return response()->json(['error' => 'Only denied requests can be edited.'], 422);
        }

        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'integer'],
            'items.*.requested_qty' => ['required', 'integer', 'min:0'],
        ]);

        $allowedIds = $issuance->items->pluck('id')->all();
        $before = $issuance->items->mapWithKeys(
            fn (IssuanceRequestItem $line) => [$line->id => (int) $line->requested_qty]
        )->all();

        foreach ($data['items'] as $row) {
            if (!in_array((int) $row['id'], $allowedIds, true)) {
                return response()->json(['error' => 'One of the lines does not belong to this request.'], 422);
            }
        }

        foreach ($data['items'] as $row) {
            IssuanceRequestItem::where('id', $row['id'])
                ->where('issuance_request_id', $issuance->id)
                ->update(['requested_qty' => (int) $row['requested_qty']]);
        }

        $issuance->refresh()->load('items');
        $after = $issuance->items->mapWithKeys(
            fn (IssuanceRequestItem $line) => [$line->id => (int) $line->requested_qty]
        )->all();

        $this->activity->log(
            $request,
            'issuance_edited',
            'Edited denied issuance request #'.$issuance->id,
            'issuance_request',
            (int) $issuance->id,
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
            'request' => $this->serialize($issuance, true),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->session()->get('user');
        $issuance = $this->findForInventory($request, $id);

        if (!RolePermissions::canDeleteIssuanceRequest($user, $issuance->uploaded_by !== null ? (int) $issuance->uploaded_by : null)) {
            return response()->json(['error' => 'You can only delete your own requests.'], 403);
        }

        if (!$issuance->isPending() && !$issuance->isDenied()) {
            return response()->json(['error' => 'Completed requests cannot be deleted.'], 422);
        }

        $label = 'issuance request #'.$issuance->id;
        $issuance->items()->delete();
        $issuance->delete();

        $this->activity->log(
            $request,
            'issuance_deleted',
            'Deleted '.$label,
            'issuance_request',
            $id
        );

        return response()->json(['success' => true]);
    }

    public function approve(Request $request, int $id): JsonResponse
    {
        if (!RolePermissions::canReviewIssuance($request->session()->get('user'))) {
            return response()->json(['error' => 'You cannot approve issuance requests.'], 403);
        }

        $issuance = $this->findForInventory($request, $id);

        try {
            $this->stock->apply(
                $request,
                $issuance,
                $this->stock->requestedQtyMap($issuance->load('items')),
                IssuanceRequest::STATUS_APPROVED,
                'issuance_approved',
                'Approved issuance request #'.$issuance->id.' and deducted requested quantities from inventory'
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json([
            'success' => true,
            'request' => $this->serialize($this->findForInventory($request, $id), true),
        ]);
    }

    public function deny(Request $request, int $id): JsonResponse
    {
        if (!RolePermissions::canReviewIssuance($request->session()->get('user'))) {
            return response()->json(['error' => 'You cannot deny issuance requests.'], 403);
        }

        $data = $request->validate([
            'reason' => ['required', 'string', 'min:3', 'max:2000'],
        ]);

        $issuance = $this->findForInventory($request, $id);
        if (!$issuance->isPending()) {
            return response()->json(['error' => 'Only pending requests can be denied.'], 422);
        }

        $reason = trim($data['reason']);
        $sessionUser = $request->session()->get('user');

        $issuance->update([
            'status' => IssuanceRequest::STATUS_DENIED,
            'rejection_reason' => $reason,
            'reviewed_by' => $sessionUser['id'] ?? null,
            'reviewed_at' => now(),
        ]);

        $this->activity->log(
            $request,
            'issuance_denied',
            'Denied issuance request #'.$issuance->id,
            'issuance_request',
            (int) $issuance->id,
            [
                'changes' => ActivityChangeSet::snapshot(
                    ['reason' => $reason],
                    ['reason' => 'Rejection reason']
                ),
            ]
        );

        return response()->json([
            'success' => true,
            'request' => $this->serialize($this->findForInventory($request, $id), true),
        ]);
    }

    public function stockEntry(Request $request, int $id): JsonResponse
    {
        if (!RolePermissions::canReviewIssuance($request->session()->get('user'))) {
            return response()->json(['error' => 'You cannot enter used stock for issuance requests.'], 403);
        }

        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'integer'],
            'items.*.qty' => ['required', 'integer', 'min:0'],
        ]);

        $issuance = $this->findForInventory($request, $id);
        $allowedIds = $issuance->items()->pluck('id')->all();
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
                $issuance->load('items'),
                $qtyByLineId,
                IssuanceRequest::STATUS_STOCK_ENTERED,
                'issuance_stock_used',
                'Entered used stock for issuance request #'.$issuance->id
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json([
            'success' => true,
            'request' => $this->serialize($this->findForInventory($request, $id), true),
        ]);
    }

    public function resubmit(Request $request, int $id): JsonResponse
    {
        if (!RolePermissions::canEditIssuance($request->session()->get('user'))) {
            return response()->json(['error' => 'You cannot resubmit this request.'], 403);
        }

        $issuance = $this->findForInventory($request, $id);
        if (!$issuance->isDenied()) {
            return response()->json(['error' => 'Only denied requests can be returned to pending.'], 422);
        }

        if (!trim((string) $issuance->rejection_reason)) {
            return response()->json(['error' => 'A manager rejection reason must be on file before resubmitting.'], 422);
        }

        $previous = $issuance->rejection_reason;

        $issuance->update([
            'status' => IssuanceRequest::STATUS_PENDING,
            'previous_rejection_reason' => $previous,
            'rejection_reason' => null,
            'reviewed_by' => null,
            'reviewed_at' => null,
        ]);

        $this->activity->log(
            $request,
            'issuance_resubmitted',
            'Resubmitted issuance request #'.$issuance->id.' to pending',
            'issuance_request',
            (int) $issuance->id,
            [
                'changes' => ActivityChangeSet::diff(
                    ['status' => IssuanceRequest::STATUS_DENIED],
                    ['status' => IssuanceRequest::STATUS_PENDING],
                    ['status' => 'Status']
                ),
            ]
        );

        return response()->json([
            'success' => true,
            'request' => $this->serialize($this->findForInventory($request, $id), true),
        ]);
    }

    private function createRequest(
        Request $request,
        int $inventoryId,
        string $source,
        ?string $filename,
        ?string $amcMode,
        array $rows,
    ): IssuanceRequest {
        $sessionUser = $request->session()->get('user');
        $catalog = Item::query()->where('inventory_id', $inventoryId)->get();

        $issuance = DB::transaction(function () use (
            $inventoryId,
            $source,
            $filename,
            $amcMode,
            $rows,
            $sessionUser,
            $catalog
        ) {
            $created = IssuanceRequest::create([
                'inventory_id' => $inventoryId,
                'status' => IssuanceRequest::STATUS_PENDING,
                'source' => $source,
                'original_filename' => $filename,
                'amc_mode' => $amcMode,
                'uploaded_by' => $sessionUser['id'] ?? null,
            ]);

            foreach ($rows as $row) {
                $matched = $this->matchItem($catalog, $row);

                $need3m = $this->parser->parseNeed($row['need_3m'] ?? 0);
                $requested = array_key_exists('requested_qty', $row)
                    ? $this->parser->parseNeed($row['requested_qty'])
                    : $need3m;

                IssuanceRequestItem::create([
                    'issuance_request_id' => $created->id,
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
            'forecast' => 'Sent forecast to issuance',
            'manual' => 'Created manual issuance request',
            default => 'Uploaded issuance file',
        };

        $this->activity->log(
            $request,
            'issuance_submitted',
            $sourceLabel
                .' as request #'.$issuance->id
                .($filename ? ' ('.$filename.')' : ''),
            'issuance_request',
            (int) $issuance->id,
            [
                'source' => $source,
                'filename' => $filename,
                'line_count' => count($rows),
            ]
        );

        return $this->findForInventory($request, (int) $issuance->id);
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

    private function findForInventory(Request $request, int $id): IssuanceRequest
    {
        $inventoryId = InventoryContext::currentId($request);
        $issuance = IssuanceRequest::query()
            ->with(['items', 'uploader:id,first_name,last_name,username', 'reviewer:id,first_name,last_name,username'])
            ->where('inventory_id', $inventoryId)
            ->find($id);

        if (!$issuance) {
            abort(response()->json(['error' => 'Issuance request not found.'], 404));
        }

        return $issuance;
    }

    private function serialize(IssuanceRequest $row, bool $withItems): array
    {
        $payload = [
            'id' => $row->id,
            'status' => $row->status,
            'source' => $row->source,
            'original_filename' => $row->original_filename,
            'amc_mode' => $row->amc_mode,
            'rejection_reason' => $row->rejection_reason,
            'previous_rejection_reason' => $row->previous_rejection_reason,
            'stock_applied_at' => $row->stock_applied_at?->toIso8601String(),
            'reviewed_at' => $row->reviewed_at?->toIso8601String(),
            'created_at' => $row->created_at?->toIso8601String(),
            'updated_at' => $row->updated_at?->toIso8601String(),
            'line_count' => $row->items->count(),
            'total_requested' => (int) $row->items->sum('requested_qty'),
            'unmatched_count' => $row->items->whereNull('item_id')->count(),
            'uploaded_by_id' => $row->uploaded_by,
            'uploaded_by' => $row->uploader?->full_name,
            'reviewed_by' => $row->reviewer?->full_name,
        ];

        if ($withItems) {
            $payload['items'] = $row->items->map(fn (IssuanceRequestItem $line) => [
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
