<?php

namespace App\Http\Controllers;

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

        $rows = DB::select(
            'SELECT t.id, t.itemId, t.action, t.quantity, t.transactionDate,
                    i.title AS itemTitle, i.itemCode
             FROM transactions t
             LEFT JOIN items i ON t.itemId = i.id
             WHERE MONTH(t.transactionDate) = ? AND YEAR(t.transactionDate) = ?
             ORDER BY t.transactionDate ASC',
            [(int) $validated['month'], (int) $validated['year']]
        );

        return response()->json($rows);
    }
}
