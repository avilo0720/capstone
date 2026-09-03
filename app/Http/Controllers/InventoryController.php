<?php

namespace App\Http\Controllers;

use App\Models\Inventory;
use App\Support\InventoryContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $current = InventoryContext::current($request);

        return response()->json([
            'inventories' => InventoryContext::allowed($request)->map(fn (Inventory $inv) => [
                'id' => $inv->id,
                'slug' => $inv->slug,
                'name' => $inv->name,
            ])->values(),
            'current' => $current ? [
                'id' => $current->id,
                'slug' => $current->slug,
                'name' => $current->name,
            ] : null,
        ]);
    }

    public function select(Request $request): JsonResponse
    {
        $data = $request->validate([
            'slug' => ['required', 'string'],
        ]);

        if (!InventoryContext::canAccessSlug($request, $data['slug'])) {
            return response()->json(['error' => 'You do not have access to this inventory'], 403);
        }

        $inventory = Inventory::query()->where('slug', $data['slug'])->first();
        if (!$inventory) {
            return response()->json(['error' => 'Inventory not found'], 404);
        }

        InventoryContext::remember($request, $inventory);

        return response()->json([
            'success' => true,
            'current' => [
                'id' => $inventory->id,
                'slug' => $inventory->slug,
                'name' => $inventory->name,
            ],
        ]);
    }
}
