<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ForecastController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = DB::select(
            "SELECT t.itemId,
                    DATE(t.transactionDate) AS day,
                    SUM(t.quantity) AS total
             FROM transactions t
             WHERE t.action = 'use'
               AND t.transactionDate >= DATE_SUB(NOW(), INTERVAL 3 MONTH)
             GROUP BY t.itemId, day
             ORDER BY t.itemId, day"
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
