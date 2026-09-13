<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Services\ActivityLogger;
use App\Support\ActivityChangeSet;
use App\Support\InventoryContext;
use App\Support\RolePermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ItemController extends Controller
{
    public function __construct(private ActivityLogger $activity)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $inventoryId = InventoryContext::currentId($request);
        if (!$inventoryId) {
            return response()->json([]);
        }
        return response()->json(Item::catalogForInventory($inventoryId));
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->session()->get('user');

        if (!RolePermissions::canEdit($user)) {
            return response()->json(['error' => 'You do not have permission to modify items'], 403);
        }

        $data = $request->validate([
            'id' => ['nullable'],
            'itemCode' => ['nullable', 'string'],
            'title' => ['required', 'string'],
            'size' => ['nullable', 'string'],
            'category' => ['nullable', 'string'],
            'quantity' => ['nullable', 'integer'],
            'price' => ['nullable', 'numeric'],
            'monthlyDemand' => ['nullable', 'integer'],
        ]);

        $normalizedId = (int) ($data['id'] ?? 0);
        $now = now();
        $inventoryId = InventoryContext::currentId($request);

        if (!$inventoryId) {
            return response()->json(['error' => 'You do not have access to this inventory'], 403);
        }

        $title = trim((string) $data['title']);
        $size = trim((string) ($data['size'] ?? ''));

        $duplicate = Item::query()
            ->where('inventory_id', $inventoryId)
            ->whereRaw('LOWER(TRIM(title)) = ?', [mb_strtolower($title)])
            ->whereRaw('LOWER(TRIM(COALESCE(size, ""))) = ?', [mb_strtolower($size)])
            ->when($normalizedId > 0, fn ($q) => $q->where('id', '!=', $normalizedId))
            ->first();

        if ($duplicate) {
            $label = $size !== '' ? "{$title} ({$size})" : $title;

            return response()->json([
                'error' => 'Duplicate item prevented. "'.$label.'" already exists in this inventory and was not saved.',
                'duplicate' => true,
                'existing_id' => $duplicate->id,
                'existing_itemCode' => $duplicate->itemCode,
            ], 422);
        }

        $data['title'] = $title;
        $data['size'] = $size !== '' ? $size : null;

        if ($normalizedId > 0) {
            $current = Item::find($normalizedId);
            $currentItemCode = $current?->itemCode;
            $after = [
                'itemCode' => $data['itemCode'] ?? $currentItemCode,
                'title' => $data['title'],
                'size' => $data['size'] ?? null,
                'category' => $data['category'] ?? null,
                'quantity' => $data['quantity'] ?? 0,
                'price' => $data['price'] ?? 0,
                'monthlyDemand' => $data['monthlyDemand'] ?? 0,
            ];

            Item::where('id', $normalizedId)->update([
                ...$after,
                'updated' => $now,
            ]);

            $this->activity->log(
                $request,
                'updated',
                'Updated item "'.$data['title'].'"',
                'item',
                $normalizedId,
                [
                    'itemCode' => $after['itemCode'],
                    'changes' => ActivityChangeSet::diff([
                        'itemCode' => $current?->itemCode,
                        'title' => $current?->title,
                        'size' => $current?->size,
                        'category' => $current?->category,
                        'quantity' => $current?->quantity,
                        'price' => $current?->price,
                        'monthlyDemand' => $current?->monthlyDemand,
                    ], $after, $this->itemFieldLabels()),
                ]
            );

            return response()->json([
                'success' => true,
                'id' => $normalizedId,
                'itemCode' => $data['itemCode'] ?? $currentItemCode,
            ]);
        }

        $itemCodes = Item::query()
            ->when($inventoryId, fn ($q) => $q->where('inventory_id', $inventoryId))
            ->pluck('itemCode');
        $maxItemCode = 0;

        foreach ($itemCodes as $code) {
            $rawCode = trim((string) $code);
            if (preg_match('/(\d+)/', $rawCode, $matches)) {
                $codeNum = (int) $matches[1];
                if ($codeNum > $maxItemCode) {
                    $maxItemCode = $codeNum;
                }
            }
        }

        $prefix = ($request->session()->get('inventory_slug') === 'office-materials') ? 'OFF-' : 'ITEM-';
        $nextItemCode = $prefix.($maxItemCode + 1);

        $item = Item::create([
            'inventory_id' => $inventoryId,
            'itemCode' => $nextItemCode,
            'title' => $data['title'],
            'size' => $data['size'] ?? null,
            'category' => $data['category'] ?? null,
            'quantity' => $data['quantity'] ?? 0,
            'price' => $data['price'] ?? 0,
            'monthlyDemand' => $data['monthlyDemand'] ?? 0,
            'updated' => $now,
        ]);

        $this->activity->log(
            $request,
            'created',
            'Added item "'.$data['title'].'"',
            'item',
            (int) $item->id,
            [
                'itemCode' => $nextItemCode,
                'quantity' => $data['quantity'] ?? 0,
                'changes' => ActivityChangeSet::snapshot([
                    'itemCode' => $nextItemCode,
                    'title' => $data['title'],
                    'size' => $data['size'] ?? null,
                    'category' => $data['category'] ?? null,
                    'quantity' => $data['quantity'] ?? 0,
                    'price' => $data['price'] ?? 0,
                    'monthlyDemand' => $data['monthlyDemand'] ?? 0,
                ], $this->itemFieldLabels()),
            ]
        );

        return response()->json([
            'success' => true,
            'id' => $item->id,
            'itemCode' => $nextItemCode,
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->session()->get('user');

        if (!RolePermissions::canEdit($user)) {
            return response()->json(['error' => 'You do not have permission to delete items'], 403);
        }

        $item = Item::find($id);
        $title = $item?->title ?? ('#'.$id);

        Item::where('id', $id)->delete();

        $this->activity->log(
            $request,
            'deleted',
            'Deleted item "'.$title.'"',
            'item',
            $id,
            [
                'itemCode' => $item?->itemCode,
                'changes' => ActivityChangeSet::snapshot([
                    'itemCode' => $item?->itemCode,
                    'title' => $item?->title,
                    'size' => $item?->size,
                    'category' => $item?->category,
                    'quantity' => $item?->quantity,
                    'price' => $item?->price,
                    'monthlyDemand' => $item?->monthlyDemand,
                ], $this->itemFieldLabels()),
            ]
        );

        return response()->json(['success' => true]);
    }

    private function itemFieldLabels(): array
    {
        return [
            'itemCode' => 'Item code',
            'title' => 'Name',
            'size' => 'Size',
            'category' => 'Category',
            'quantity' => 'Quantity',
            'price' => 'Unit cost',
            'monthlyDemand' => 'Monthly demand',
        ];
    }
}
