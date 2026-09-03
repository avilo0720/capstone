<?php

namespace App\Http\Controllers;

use App\Services\ReportService;
use App\Support\InventoryContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function __construct(private readonly ReportService $reportService)
    {
    }

    public function summary(Request $request): JsonResponse
    {
        $inventoryId = InventoryContext::currentId($request);
        if (!$inventoryId) {
            return response()->json($this->reportService->buildSummary([]));
        }
        $items = collect(DB::select("
            SELECT * FROM items
            WHERE inventory_id = ?
            ORDER BY CAST(REGEXP_SUBSTR(COALESCE(itemCode, '0'), '[0-9]+') AS UNSIGNED) ASC, id ASC
        ", [$inventoryId]))->map(fn ($row) => (array) $row)->all();

        return response()->json($this->reportService->buildSummary($items));
    }
}
