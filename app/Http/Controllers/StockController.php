<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Models\Transaction;
use App\Services\ActivityLogger;
use App\Support\RolePermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StockController extends Controller
{
    public function __construct(private ActivityLogger $activity)
    {
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->session()->get('user');

        if (!RolePermissions::canEdit($user)) {
            return response()->json(['error' => 'You do not have permission to manage stock'], 403);
        }

        $data = $request->validate([
            'itemId' => ['required', 'integer'],
            'action' => ['required', 'in:add,use'],
            'quantity' => ['required', 'integer', 'min:1'],
        ]);

        $item = Item::find($data['itemId']);

        if (!$item) {
            return response()->json(['error' => 'Item not found'], 404);
        }

        $currentQty = (int) $item->quantity;
        $changeQty = (int) $data['quantity'];

        if ($data['action'] === 'add') {
            $newQuantity = $currentQty + $changeQty;
        } else {
            $newQuantity = max(0, $currentQty - $changeQty);
        }

        $now = now();

        $item->update([
            'quantity' => $newQuantity,
            'updated' => $now,
        ]);

        Transaction::create([
            'itemId' => $data['itemId'],
            'action' => $data['action'],
            'quantity' => $changeQty,
            'transactionDate' => $now,
            'created_at' => $now,
        ]);

        $verb = $data['action'] === 'add' ? 'Added' : 'Used';
        $this->activity->log(
            $request,
            $data['action'] === 'add' ? 'stock_added' : 'stock_used',
            $verb.' '.$changeQty.' of "'.$item->title.'" (now '.$newQuantity.')',
            'item',
            (int) $item->id,
            [
                'quantity' => $changeQty,
                'previous_quantity' => $currentQty,
                'new_quantity' => $newQuantity,
            ]
        );

        return response()->json([
            'success' => true,
            'newQuantity' => $newQuantity,
        ]);
    }
}
