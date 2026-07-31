<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Services\ActivityLogger;
use App\Support\RolePermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ItemController extends Controller
{
    public function __construct(private ActivityLogger $activity)
    {
    }

    public function index(): JsonResponse
    {
        $rows = DB::select("
            SELECT * FROM items
            ORDER BY CAST(REGEXP_SUBSTR(COALESCE(itemCode, '0'), '[0-9]+') AS UNSIGNED) ASC, id ASC
        ");

        return response()->json($rows);
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

        if ($normalizedId > 0) {
            $current = Item::find($normalizedId);
            $currentItemCode = $current?->itemCode;

            Item::where('id', $normalizedId)->update([
                'itemCode' => $data['itemCode'] ?? $currentItemCode,
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
                'updated',
                'Updated item "'.$data['title'].'"',
                'item',
                $normalizedId,
                ['itemCode' => $data['itemCode'] ?? $currentItemCode]
            );

            return response()->json([
                'success' => true,
                'id' => $normalizedId,
                'itemCode' => $data['itemCode'] ?? $currentItemCode,
            ]);
        }

        $itemCodes = Item::pluck('itemCode');
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

        $nextItemCode = (string) ($maxItemCode + 1);

        $item = Item::create([
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
            ['itemCode' => $nextItemCode, 'quantity' => $data['quantity'] ?? 0]
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
            $id
        );

        return response()->json(['success' => true]);
    }
}
