<?php

namespace App\Http\Controllers;

use App\Support\InventoryContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TransactionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'month' => ['required', 'integer', 'min:1', 'max:12'],
            'year' => ['required', 'integer'],
        ]);

        $inventoryId = InventoryContext::currentId($request);
        if (!$inventoryId) {
            return response()->json([]);
        }
        $rows = DB::select(
            'SELECT t.id, t.itemId, t.action, t.quantity, t.transactionDate,
                    i.title AS itemTitle, i.itemCode
             FROM transactions t
             LEFT JOIN items i ON t.itemId = i.id
             WHERE MONTH(t.transactionDate) = ? AND YEAR(t.transactionDate) = ?
               AND i.inventory_id = ?
             ORDER BY t.transactionDate ASC',
            [(int) $validated['month'], (int) $validated['year'], $inventoryId]
        );

        return response()->json($rows);
    }

    /**
     * Each item's stock at the end of the month: today's quantity with every later
     * transaction undone. For the current month this is the quantity on hand now.
     */
    public function monthEndStock(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'month' => ['required', 'integer', 'min:1', 'max:12'],
            'year' => ['required', 'integer'],
        ]);

        $inventoryId = InventoryContext::currentId($request);
        if (!$inventoryId) {
            return response()->json((object) []);
        }

        $monthEnd = sprintf('%04d-%02d-01', $validated['year'], $validated['month']);
        $rows = DB::select(
            "SELECT i.id, i.quantity,
                    COALESCE(SUM(CASE WHEN t.action = 'add' THEN t.quantity ELSE -t.quantity END), 0) AS later
             FROM items i
             LEFT JOIN transactions t ON t.itemId = i.id AND t.transactionDate >= DATE_ADD(?, INTERVAL 1 MONTH)
             WHERE i.inventory_id = ?
             GROUP BY i.id, i.quantity",
            [$monthEnd, $inventoryId]
        );

        $stock = [];
        foreach ($rows as $row) {
            $stock[(string) $row->id] = (int) $row->quantity - (int) $row->later;
        }

        return response()->json((object) $stock);
    }
}
