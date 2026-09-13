<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Services\ReportService;
use App\Support\InventoryContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
        $items = Item::catalogForInventory($inventoryId)->map(fn (Item $row) => $row->toArray())->all();

        return response()->json($this->reportService->buildSummary($items));
    }
}
