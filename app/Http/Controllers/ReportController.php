<?php

namespace App\Http\Controllers;

use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function __construct(private readonly ReportService $reportService)
    {
    }

    public function summary(): JsonResponse
    {
        $items = collect(DB::select("
            SELECT * FROM items
            ORDER BY CAST(REGEXP_SUBSTR(COALESCE(itemCode, '0'), '[0-9]+') AS UNSIGNED) ASC, id ASC
        "))->map(fn ($row) => (array) $row)->all();

        return response()->json($this->reportService->buildSummary($items));
    }
}
