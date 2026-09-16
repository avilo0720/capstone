<?php

namespace App\Http\Controllers;

use App\Services\ExportService;
use App\Support\RolePermissions;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

class ExportController extends Controller
{
    public function __construct(private readonly ExportService $exportService)
    {
    }

    public function inventoryExcel(Request $request): Response
    {
        $data = $request->validate([
            'headers' => ['nullable', 'array'],
            'rows' => ['nullable', 'array'],
        ]);

        $buffer = $this->exportService->tableToExcel(
            $data['headers'] ?? [],
            $data['rows'] ?? [],
            'Inventory'
        );

        return response($buffer, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="inventory.xlsx"',
        ]);
    }

    public function inventoryPdf(Request $request): Response
    {
        $data = $request->validate([
            'headers' => ['nullable', 'array'],
            'rows' => ['nullable', 'array'],
            ...$this->pdfStyleRules(),
        ]);

        $buffer = $this->exportService->tableToPdf(
            'Inventory Export',
            $data['headers'] ?? [],
            $data['rows'] ?? [],
            $data['paper'] ?? 'A4',
            $data['orientation'] ?? 'landscape',
            $data['fontSize'] ?? 'medium',
            $data['rowSize'] ?? 'normal'
        );

        return response($buffer, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="inventory.pdf"',
        ]);
    }

    public function reportPdf(Request $request): Response
    {
        $data = $request->validate([
            'summary' => ['nullable', 'array'],
            'lowStockItems' => ['nullable', 'array'],
            ...$this->pdfStyleRules(),
        ]);

        $buffer = $this->exportService->reportToPdf(
            $data['summary'] ?? null,
            $data['lowStockItems'] ?? [],
            $data['paper'] ?? 'A4',
            $data['orientation'] ?? 'portrait',
            $data['fontSize'] ?? 'medium',
            $data['rowSize'] ?? 'normal'
        );

        return response($buffer, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="inventory_report.pdf"',
        ]);
    }

    public function reportExcel(Request $request): Response
    {
        $data = $request->validate([
            'summary' => ['nullable', 'array'],
            'lowStockItems' => ['nullable', 'array'],
        ]);

        $buffer = $this->exportService->reportToExcel(
            $data['summary'] ?? null,
            $data['lowStockItems'] ?? []
        );

        return response($buffer, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="inventory_report.xlsx"',
        ]);
    }

    public function forecastExcel(Request $request): Response
    {
        $data = $request->validate([
            'headers' => ['nullable', 'array'],
            'rows' => ['nullable', 'array'],
        ]);

        $buffer = $this->exportService->tableToExcel(
            $data['headers'] ?? [],
            $data['rows'] ?? [],
            'Forecast'
        );

        return response($buffer, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="forecast.xlsx"',
        ]);
    }

    public function forecastPdf(Request $request): Response
    {
        $data = $request->validate([
            'headers' => ['nullable', 'array'],
            'rows' => ['nullable', 'array'],
            ...$this->pdfStyleRules(),
        ]);

        $buffer = $this->exportService->tableToPdf(
            'Inventory Forecast',
            $data['headers'] ?? [],
            $data['rows'] ?? [],
            $data['paper'] ?? 'A4',
            $data['orientation'] ?? 'landscape',
            $data['fontSize'] ?? 'medium',
            $data['rowSize'] ?? 'normal'
        );

        return response($buffer, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="forecast.pdf"',
        ]);
    }

    public function inventoryPreview(Request $request): Response
    {
        $data = $request->validate([
            'format' => ['required', 'string', Rule::in(['pdf', 'excel'])],
            'headers' => ['nullable', 'array'],
            'rows' => ['nullable', 'array'],
            ...$this->pdfStyleRules(),
        ]);

        if ($data['format'] === 'excel') {
            $html = $this->exportService->tableToHtml(
                $data['headers'] ?? [],
                $data['rows'] ?? [],
                'Inventory'
            );

            return response($html, 200, [
                'Content-Type' => 'text/html; charset=UTF-8',
                'Content-Disposition' => 'inline; filename="inventory-preview.html"',
            ]);
        }

        $buffer = $this->exportService->tableToPdf(
            'Inventory Export',
            $data['headers'] ?? [],
            $data['rows'] ?? [],
            $data['paper'] ?? 'A4',
            $data['orientation'] ?? 'landscape',
            $data['fontSize'] ?? 'medium',
            $data['rowSize'] ?? 'normal'
        );

        return response($buffer, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="inventory-preview.pdf"',
        ]);
    }

    public function calendarExcel(Request $request): Response
    {
        $this->assertCalendarTable($request);
        $data = $request->validate([
            'headers' => ['nullable', 'array'],
            'rows' => ['nullable', 'array'],
        ]);

        $buffer = $this->exportService->tableToExcel(
            $data['headers'] ?? [],
            $data['rows'] ?? [],
            'Monthly report'
        );

        return response($buffer, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="calendar-monthly-report.xlsx"',
        ]);
    }

    public function calendarPdf(Request $request): Response
    {
        $this->assertCalendarTable($request);
        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:180'],
            'headers' => ['nullable', 'array'],
            'rows' => ['nullable', 'array'],
            ...$this->pdfStyleRules(),
        ]);

        $buffer = $this->exportService->tableToPdf(
            $data['title'] ?? 'Monthly Calendar Report',
            $data['headers'] ?? [],
            $data['rows'] ?? [],
            $data['paper'] ?? 'legal',
            $data['orientation'] ?? 'landscape',
            $data['fontSize'] ?? 'small',
            $data['rowSize'] ?? 'compact'
        );

        return response($buffer, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="calendar-monthly-report.pdf"',
        ]);
    }

    public function calendarPreview(Request $request): Response
    {
        $this->assertCalendarTable($request);
        $data = $request->validate([
            'format' => ['required', 'string', Rule::in(['pdf', 'excel'])],
            'title' => ['nullable', 'string', 'max:180'],
            'headers' => ['nullable', 'array'],
            'rows' => ['nullable', 'array'],
            ...$this->pdfStyleRules(),
        ]);

        if ($data['format'] === 'excel') {
            $html = $this->exportService->tableToHtml(
                $data['headers'] ?? [],
                $data['rows'] ?? [],
                'Monthly report'
            );

            return response($html, 200, [
                'Content-Type' => 'text/html; charset=UTF-8',
                'Content-Disposition' => 'inline; filename="calendar-preview.html"',
            ]);
        }

        $buffer = $this->exportService->tableToPdf(
            $data['title'] ?? 'Monthly Calendar Report',
            $data['headers'] ?? [],
            $data['rows'] ?? [],
            $data['paper'] ?? 'legal',
            $data['orientation'] ?? 'landscape',
            $data['fontSize'] ?? 'small',
            $data['rowSize'] ?? 'compact'
        );

        return response($buffer, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="calendar-preview.pdf"',
        ]);
    }

    public function forecastPreview(Request $request): Response
    {
        $data = $request->validate([
            'format' => ['required', 'string', Rule::in(['pdf', 'excel'])],
            'headers' => ['nullable', 'array'],
            'rows' => ['nullable', 'array'],
            ...$this->pdfStyleRules(),
        ]);

        if ($data['format'] === 'excel') {
            $html = $this->exportService->tableToHtml(
                $data['headers'] ?? [],
                $data['rows'] ?? [],
                'Forecast'
            );

            return response($html, 200, [
                'Content-Type' => 'text/html; charset=UTF-8',
                'Content-Disposition' => 'inline; filename="forecast-preview.html"',
            ]);
        }

        $buffer = $this->exportService->tableToPdf(
            'Inventory Forecast',
            $data['headers'] ?? [],
            $data['rows'] ?? [],
            $data['paper'] ?? 'A4',
            $data['orientation'] ?? 'landscape',
            $data['fontSize'] ?? 'medium',
            $data['rowSize'] ?? 'normal'
        );

        return response($buffer, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="forecast-preview.pdf"',
        ]);
    }

    public function reportPreview(Request $request): Response
    {
        $data = $request->validate([
            'format' => ['required', 'string', Rule::in(['pdf', 'excel'])],
            'summary' => ['nullable', 'array'],
            'lowStockItems' => ['nullable', 'array'],
            ...$this->pdfStyleRules(),
        ]);

        if ($data['format'] === 'excel') {
            $html = $this->exportService->reportToHtml(
                $data['summary'] ?? null,
                $data['lowStockItems'] ?? []
            );

            return response($html, 200, [
                'Content-Type' => 'text/html; charset=UTF-8',
                'Content-Disposition' => 'inline; filename="report-preview.html"',
            ]);
        }

        $buffer = $this->exportService->reportToPdf(
            $data['summary'] ?? null,
            $data['lowStockItems'] ?? [],
            $data['paper'] ?? 'A4',
            $data['orientation'] ?? 'portrait',
            $data['fontSize'] ?? 'medium',
            $data['rowSize'] ?? 'normal'
        );

        return response($buffer, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="report-preview.pdf"',
        ]);
    }

    public function procurementExcel(Request $request): Response
    {
        $data = $request->validate([
            'headers' => ['nullable', 'array'],
            'rows' => ['nullable', 'array'],
        ]);

        $buffer = $this->exportService->tableToExcel(
            $data['headers'] ?? [],
            $data['rows'] ?? [],
            'Procurement'
        );

        return response($buffer, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="procurement-report.xlsx"',
        ]);
    }

    public function procurementPdf(Request $request): Response
    {
        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:180'],
            'headers' => ['nullable', 'array'],
            'rows' => ['nullable', 'array'],
            ...$this->pdfStyleRules(),
        ]);

        $buffer = $this->exportService->tableToPdf(
            $data['title'] ?? 'Procurement Report',
            $data['headers'] ?? [],
            $data['rows'] ?? [],
            $data['paper'] ?? 'A4',
            $data['orientation'] ?? 'landscape',
            $data['fontSize'] ?? 'medium',
            $data['rowSize'] ?? 'normal'
        );

        return response($buffer, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="procurement-report.pdf"',
        ]);
    }

    public function procurementPreview(Request $request): Response
    {
        $data = $request->validate([
            'format' => ['required', 'string', Rule::in(['pdf', 'excel'])],
            'title' => ['nullable', 'string', 'max:180'],
            'headers' => ['nullable', 'array'],
            'rows' => ['nullable', 'array'],
            ...$this->pdfStyleRules(),
        ]);

        if ($data['format'] === 'excel') {
            $html = $this->exportService->tableToHtml(
                $data['headers'] ?? [],
                $data['rows'] ?? [],
                'Procurement'
            );

            return response($html, 200, [
                'Content-Type' => 'text/html; charset=UTF-8',
                'Content-Disposition' => 'inline; filename="procurement-preview.html"',
            ]);
        }

        $buffer = $this->exportService->tableToPdf(
            $data['title'] ?? 'Procurement Report',
            $data['headers'] ?? [],
            $data['rows'] ?? [],
            $data['paper'] ?? 'A4',
            $data['orientation'] ?? 'landscape',
            $data['fontSize'] ?? 'medium',
            $data['rowSize'] ?? 'normal'
        );

        return response($buffer, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="procurement-preview.pdf"',
        ]);
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    private function assertCalendarTable(Request $request): void
    {
        if (!RolePermissions::canViewCalendarTable($request->session()->get('user'))) {
            abort(403, 'You do not have permission to download the calendar table report.');
        }
    }

    private function pdfStyleRules(): array
    {
        return [
            'paper' => ['nullable', 'string', Rule::in(['A4', 'a4', 'letter', 'legal'])],
            'orientation' => ['nullable', 'string', Rule::in(['portrait', 'landscape'])],
            'fontSize' => ['nullable', 'string', Rule::in(['small', 'medium', 'large', 'xlarge'])],
            'rowSize' => ['nullable', 'string', Rule::in(['compact', 'normal', 'comfortable'])],
        ];
    }
}
