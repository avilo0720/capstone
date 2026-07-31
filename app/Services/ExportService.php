<?php

namespace App\Services;

use Dompdf\Dompdf;
use Dompdf\Options;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Html as HtmlWriter;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class ExportService
{
    private const ALLOWED_ORIENTATIONS = ['portrait', 'landscape'];

    public function tableToExcel(array $headers, array $rows, string $sheetName = 'Sheet1'): string
    {
        return $this->writeXlsx($this->buildTableSpreadsheet($headers, $rows, $sheetName));
    }

    public function tableToHtml(array $headers, array $rows, string $sheetName = 'Sheet1'): string
    {
        return $this->writeHtml($this->buildTableSpreadsheet($headers, $rows, $sheetName));
    }

    public function tableToPdf(
        string $title,
        array $headers,
        array $rows,
        string $paper = 'A4',
        string $orientation = 'landscape',
        string $fontSize = 'medium',
        string $rowSize = 'normal'
    ): string {
        $orientation = $this->normalizeOrientation($orientation);
        $isPortrait = $orientation === 'portrait';
        $columnCount = max(count($headers), 1);
        $styles = $this->resolveTablePdfStyles($columnCount, $isPortrait, $fontSize, $rowSize);

        $compactHeaders = array_map(fn ($header) => $this->compactPdfHeader((string) $header), $headers);

        $html = '<html><head><meta charset="utf-8"><style>
            @page { margin: ' . $styles['pageMargin'] . '; }
            body { font-family: DejaVu Sans, sans-serif; font-size: ' . $styles['fontSize'] . '; color: #101828; }
            h1 { font-size: ' . $styles['titleSize'] . '; margin: 0 0 2px; }
            .meta { color: #667085; font-size: ' . $styles['metaSize'] . '; margin: 0 0 6px; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th, td {
                border: 0.5pt solid #D0D5DD;
                padding: ' . $styles['cellPadding'] . ';
                text-align: left;
                vertical-align: middle;
            }
            th {
                background: #EEF2F6;
                font-size: ' . $styles['headerSize'] . ';
                font-weight: bold;
                white-space: nowrap;
            }
            td { word-wrap: break-word; overflow-wrap: break-word; }
            td.num, th.num { text-align: right; white-space: nowrap; }
            td.nowrap { white-space: nowrap; }
            .item-col { width: ' . $styles['itemWidth'] . '; }
            .size-col { width: ' . $styles['sizeWidth'] . '; }
            .cost-col { width: ' . $styles['costWidth'] . '; text-align: right; white-space: nowrap; }
            .trigger-col { width: ' . $styles['triggerWidth'] . '; }
        </style></head><body>';
        $html .= '<h1>' . htmlspecialchars($title) . '</h1>';
        $html .= '<p class="meta">Generated: ' . htmlspecialchars(now()->toDateTimeString()) . '</p>';
        $html .= '<table><thead><tr>';

        foreach ($compactHeaders as $index => $header) {
            $class = $this->pdfHeaderClass((string) ($headers[$index] ?? $header));
            $html .= '<th' . ($class !== '' ? ' class="' . $class . '"' : '') . '>'
                . htmlspecialchars($header) . '</th>';
        }

        $html .= '</tr></thead><tbody>';

        foreach ($rows as $row) {
            $html .= '<tr>';
            foreach (array_values($row) as $index => $cell) {
                $originalHeader = (string) ($headers[$index] ?? '');
                $class = $this->pdfCellClass($originalHeader);
                $value = $this->formatPdfCell((string) ($cell ?? ''), $originalHeader);
                $html .= '<td' . ($class !== '' ? ' class="' . $class . '"' : '') . '>'
                    . htmlspecialchars($value) . '</td>';
            }
            $html .= '</tr>';
        }

        $html .= '</tbody></table></body></html>';

        return $this->renderPdf($html, $paper, $orientation);
    }

    public function reportToPdf(
        ?array $summary,
        array $lowStockItems,
        string $paper = 'A4',
        string $orientation = 'portrait',
        string $fontSize = 'medium',
        string $rowSize = 'normal'
    ): string {
        $styles = $this->resolveReportPdfStyles($fontSize, $rowSize);

        $html = '<html><head><meta charset="utf-8"><style>
            @page { margin: 12mm; }
            body { font-family: DejaVu Sans, sans-serif; font-size: ' . $styles['fontSize'] . '; color: #344054; }
            h1 { font-size: ' . $styles['titleSize'] . '; text-align: center; color: #101828; margin: 0 0 4px; }
            h2 { font-size: ' . $styles['headingSize'] . '; color: #101828; border-bottom: 1px solid #D0D5DD; padding-bottom: 4px; }
            p { margin: 0 0 ' . $styles['paragraphGap'] . '; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #D0D5DD; padding: ' . $styles['cellPadding'] . '; text-align: left; }
            th { background: #EEF2F6; color: #667085; font-size: ' . $styles['headerSize'] . '; }
        </style></head><body>';
        $html .= '<h1>Inventory Summary Report</h1>';
        $html .= '<p style="text-align:center;color:#667085;">Generated: ' . htmlspecialchars(now()->toDateTimeString()) . '</p>';

        if ($summary) {
            $html .= '<h2>Summary</h2>';
            $html .= '<p>Total Items: ' . (int) ($summary['totalItems'] ?? 0) . '</p>';
            $html .= '<p>Total Quantity: ' . (int) ($summary['totalQuantity'] ?? 0) . '</p>';
            $html .= '<p>Total Value: ₱' . number_format((float) ($summary['totalValue'] ?? 0)) . '</p>';
            $html .= '<p>Items Needing Restock: ' . (int) ($summary['lowStockCount'] ?? 0) . '</p>';
        }

        if (!empty($lowStockItems)) {
            $headers = ['Item', 'Stock', 'ROP', 'MSL', 'Deficit', 'Urgency'];
            $html .= '<h2>Low-Stock Alerts</h2><table><thead><tr>';
            foreach ($headers as $header) {
                $html .= '<th>' . htmlspecialchars($header) . '</th>';
            }
            $html .= '</tr></thead><tbody>';

            foreach ($lowStockItems as $item) {
                $html .= '<tr>';
                $html .= '<td>' . htmlspecialchars((string) ($item['title'] ?? '')) . '</td>';
                $html .= '<td>' . (int) ($item['currentStock'] ?? 0) . '</td>';
                $html .= '<td>' . (int) ($item['reorderPoint'] ?? 0) . '</td>';
                $html .= '<td>' . (int) ($item['minimumStockLevel'] ?? 0) . '</td>';
                $html .= '<td>' . (int) ($item['deficit'] ?? 0) . '</td>';
                $html .= '<td>' . htmlspecialchars(strtoupper((string) ($item['urgency'] ?? ''))) . '</td>';
                $html .= '</tr>';
            }

            $html .= '</tbody></table>';
        }

        $html .= '</body></html>';

        return $this->renderPdf($html, $paper, $orientation);
    }

    public function reportToExcel(?array $summary, array $lowStockItems): string
    {
        return $this->writeXlsx($this->buildReportSpreadsheet($summary, $lowStockItems));
    }

    public function reportToHtml(?array $summary, array $lowStockItems): string
    {
        return $this->writeHtml($this->buildReportSpreadsheet($summary, $lowStockItems));
    }

    private function buildTableSpreadsheet(array $headers, array $rows, string $sheetName): Spreadsheet
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle(mb_substr($sheetName, 0, 31));
        $sheet->fromArray([$headers, ...$rows], null, 'A1');

        return $spreadsheet;
    }

    private function buildReportSpreadsheet(?array $summary, array $lowStockItems): Spreadsheet
    {
        $spreadsheet = new Spreadsheet();

        $summarySheet = $spreadsheet->getActiveSheet();
        $summarySheet->setTitle('Summary');
        $summarySheet->fromArray([
            ['Inventory Summary Report'],
            ['Generated: ' . now()->toDateTimeString()],
            [],
            ['Metric', 'Value'],
            ['Total Items', $summary['totalItems'] ?? 0],
            ['Total Quantity', $summary['totalQuantity'] ?? 0],
            ['Total Value', $summary['totalValue'] ?? 0],
            ['Items Needing Restock', $summary['lowStockCount'] ?? 0],
        ], null, 'A1');

        $alertSheet = $spreadsheet->createSheet();
        $alertSheet->setTitle('Low-Stock Alerts');
        $alertHeaders = [
            'Item Code', 'Item Name', 'Size', 'Current Stock', 'Reorder Point',
            'Min Stock Level', 'Deficit', 'Unit Cost', 'Restock Cost', 'FSN', 'Urgency',
        ];
        $alertRows = array_map(function (array $item) {
            return [
                $item['itemCode'] ?? '',
                $item['title'] ?? '',
                $item['size'] ?? '',
                $item['currentStock'] ?? 0,
                $item['reorderPoint'] ?? 0,
                $item['minimumStockLevel'] ?? 0,
                $item['deficit'] ?? 0,
                $item['unitCost'] ?? 0,
                $item['restockCost'] ?? 0,
                $item['fsn'] ?? '',
                $item['urgency'] ?? '',
            ];
        }, $lowStockItems);

        $alertSheet->fromArray([$alertHeaders, ...$alertRows], null, 'A1');

        return $spreadsheet;
    }

    private function writeXlsx(Spreadsheet $spreadsheet): string
    {
        $writer = new Xlsx($spreadsheet);
        ob_start();
        $writer->save('php://output');

        return (string) ob_get_clean();
    }

    private function writeHtml(Spreadsheet $spreadsheet): string
    {
        $writer = new HtmlWriter($spreadsheet);
        $writer->writeAllSheets();
        ob_start();
        $writer->save('php://output');

        return (string) ob_get_clean();
    }

    private function renderPdf(string $html, string $paper, string $orientation): string
    {
        $paperSize = $this->resolvePaperSize($paper);
        $orientation = $this->normalizeOrientation($orientation);

        $options = new Options();
        $options->set('isRemoteEnabled', false);
        $options->set('defaultFont', 'DejaVu Sans');

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper($paperSize, $orientation);
        $dompdf->render();

        return $dompdf->output();
    }

    /**
     * @return string|array{0: float, 1: float}
     */
    private function resolvePaperSize(string $paper): string|array
    {
        return match (strtolower(trim($paper))) {
            'letter' => 'letter',
            // Philippine long bond / folio (8.5 × 13 in), not US Legal (8.5 × 14).
            // Dompdf custom sizes must be [x0, y0, x1, y1] in points.
            'legal' => [0.0, 0.0, 8.5 * 72, 13 * 72],
            default => 'A4',
        };
    }

    private function normalizeOrientation(string $orientation): string
    {
        $normalized = strtolower(trim($orientation));

        return in_array($normalized, self::ALLOWED_ORIENTATIONS, true) ? $normalized : 'portrait';
    }

    /**
     * @return array{
     *   fontSize: string,
     *   headerSize: string,
     *   titleSize: string,
     *   metaSize: string,
     *   cellPadding: string,
     *   pageMargin: string,
     *   itemWidth: string,
     *   sizeWidth: string,
     *   costWidth: string,
     *   triggerWidth: string
     * }
     */
    private function resolveTablePdfStyles(
        int $columnCount,
        bool $isPortrait,
        string $fontSize,
        string $rowSize
    ): array {
        if ($isPortrait && $columnCount >= 14) {
            $baseFont = 5.5;
            $baseHeader = 5.0;
            $pageMargin = '6mm 4mm';
            $itemWidth = '11%';
            $sizeWidth = '6%';
            $costWidth = '9%';
            $triggerWidth = '7%';
        } elseif ($columnCount >= 14) {
            $baseFont = 6.5;
            $baseHeader = 6.0;
            $pageMargin = '8mm 6mm';
            $itemWidth = '13%';
            $sizeWidth = '7%';
            $costWidth = '8%';
            $triggerWidth = '8%';
        } elseif ($columnCount >= 10) {
            $baseFont = 7.5;
            $baseHeader = 7.0;
            $pageMargin = '8mm 6mm';
            $itemWidth = '16%';
            $sizeWidth = '8%';
            $costWidth = '9%';
            $triggerWidth = '9%';
        } else {
            $baseFont = 9.0;
            $baseHeader = 8.0;
            $pageMargin = '10mm 8mm';
            $itemWidth = '20%';
            $sizeWidth = '10%';
            $costWidth = '12%';
            $triggerWidth = '12%';
        }

        $fontScale = match (strtolower($fontSize)) {
            'small' => 0.85,
            'large' => 1.25,
            'xlarge' => 1.5,
            default => 1.0,
        };

        $cellPadding = match (strtolower($rowSize)) {
            'compact' => '1px 2px',
            'comfortable' => '5px 6px',
            default => '2px 4px',
        };

        $body = round($baseFont * $fontScale, 1);
        $header = round($baseHeader * $fontScale, 1);

        return [
            'fontSize' => $body . 'pt',
            'headerSize' => $header . 'pt',
            'titleSize' => round(11 * $fontScale, 1) . 'pt',
            'metaSize' => round(7 * $fontScale, 1) . 'pt',
            'cellPadding' => $cellPadding,
            'pageMargin' => $pageMargin,
            'itemWidth' => $itemWidth,
            'sizeWidth' => $sizeWidth,
            'costWidth' => $costWidth,
            'triggerWidth' => $triggerWidth,
        ];
    }

    /**
     * @return array{
     *   fontSize: string,
     *   headerSize: string,
     *   titleSize: string,
     *   headingSize: string,
     *   cellPadding: string,
     *   paragraphGap: string
     * }
     */
    private function resolveReportPdfStyles(string $fontSize, string $rowSize): array
    {
        $fontScale = match (strtolower($fontSize)) {
            'small' => 0.85,
            'large' => 1.25,
            'xlarge' => 1.5,
            default => 1.0,
        };

        $cellPadding = match (strtolower($rowSize)) {
            'compact' => '2px 3px',
            'comfortable' => '7px 8px',
            default => '4px 5px',
        };

        $paragraphGap = match (strtolower($rowSize)) {
            'compact' => '3px',
            'comfortable' => '8px',
            default => '5px',
        };

        return [
            'fontSize' => round(10 * $fontScale, 1) . 'px',
            'headerSize' => round(9 * $fontScale, 1) . 'px',
            'titleSize' => round(18 * $fontScale, 1) . 'px',
            'headingSize' => round(12 * $fontScale, 1) . 'px',
            'cellPadding' => $cellPadding,
            'paragraphGap' => $paragraphGap,
        ];
    }

    private function compactPdfHeader(string $header): string
    {
        return match ($header) {
            'Item Description' => 'Item',
            'Current Stock' => 'Stock',
            'Lead Time (Months)' => 'LT Mo',
            'Unit Cost' => 'Unit (P)',
            'Total Cost' => 'Total (P)',
            'Trigger Point' => 'Trigger',
            'Cumulative' => 'Cumul',
            default => $header,
        };
    }

    private function pdfHeaderClass(string $header): string
    {
        return match ($header) {
            'Item Description' => 'item-col',
            'Size' => 'size-col',
            'Unit Cost', 'Total Cost' => 'cost-col',
            'Trigger Point' => 'trigger-col',
            'No', 'AMC', 'FSN', 'LTD', 'SS', 'ROP', 'MSL', '%', 'Current Stock',
            'Cumul', 'Cumulative', 'Lead Time (Months)' => 'num',
            default => '',
        };
    }

    private function pdfCellClass(string $header): string
    {
        return match ($header) {
            'Item Description' => 'item-col',
            'Size' => 'size-col nowrap',
            'Unit Cost', 'Total Cost' => 'cost-col',
            'Trigger Point' => 'trigger-col nowrap',
            'FSN', 'No', 'AMC', 'LTD', 'SS', 'ROP', 'MSL', '%', 'Current Stock',
            'Cumulative', 'Lead Time (Months)' => 'num',
            default => '',
        };
    }

    private function formatPdfCell(string $value, string $header = ''): string
    {
        // Currency symbol is shown in the header so values stay short enough for portrait.
        if (in_array($header, ['Unit Cost', 'Total Cost'], true)) {
            $numeric = preg_replace('/[^0-9.\-]/', '', $value);
            if ($numeric !== '' && is_numeric($numeric)) {
                return number_format((float) $numeric, 2, '.', '');
            }
        }

        return str_replace('₱', 'P', $value);
    }
}
