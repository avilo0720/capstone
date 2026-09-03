<?php

namespace App\Http\Controllers;

use App\Support\InventoryContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ForecastController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $inventoryId = InventoryContext::currentId($request);
        if (!$inventoryId) {
            return response()->json([]);
        }
        $rows = DB::select(
            "SELECT t.itemId,
                    DATE(t.transactionDate) AS day,
                    SUM(t.quantity) AS total
             FROM transactions t
             INNER JOIN items i ON i.id = t.itemId
             WHERE t.action = 'use'
               AND i.inventory_id = ?
               AND t.transactionDate >= DATE_SUB(NOW(), INTERVAL 3 MONTH)
             GROUP BY t.itemId, day
             ORDER BY t.itemId, day",
            [$inventoryId]
        );

        $usage = [];

        foreach ($rows as $row) {
            $itemId = $row->itemId;
            if (!isset($usage[$itemId])) {
                $usage[$itemId] = [];
            }

            $usage[$itemId][] = [
                'date' => $row->day,
                'qty' => (int) $row->total,
            ];
        }

        return response()->json($usage);
    }
}
