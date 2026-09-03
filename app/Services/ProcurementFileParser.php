<?php

namespace App\Services;

use PhpOffice\PhpSpreadsheet\IOFactory;

class ProcurementFileParser
{
    public function parse(string $path, string $originalName): array
    {
        $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

        if ($ext === 'csv') {
            return $this->fromMatrix($this->readCsv($path));
        }

        if (!in_array($ext, ['xlsx', 'xls'], true)) {
            throw new \InvalidArgumentException('Upload an Excel (.xlsx) or CSV file exported from Forecasting.');
        }

        $spreadsheet = IOFactory::load($path);
        $sheet = $spreadsheet->getActiveSheet();
        $matrix = [];

        foreach ($sheet->toArray(null, true, true, false) as $row) {
            $matrix[] = array_map(fn ($cell) => $cell === null ? '' : (string) $cell, $row);
        }

        return $this->fromMatrix($matrix);
    }

    private function readCsv(string $path): array
    {
        $handle = fopen($path, 'r');
        if ($handle === false) {
            throw new \InvalidArgumentException('Could not read the uploaded file.');
        }

        $rows = [];
        while (($row = fgetcsv($handle)) !== false) {
            $rows[] = array_map(fn ($cell) => $cell === null ? '' : (string) $cell, $row);
        }
        fclose($handle);

        return $rows;
    }

    private function fromMatrix(array $matrix): array
    {
        $headerIndex = $this->findHeaderRow($matrix);
        if ($headerIndex === null) {
            throw new \InvalidArgumentException('Could not find forecast columns (Item Code, 3 Months Need, …).');
        }

        $headers = $matrix[$headerIndex];
        $map = $this->mapHeaders($headers);
        if (!isset($map['item_code']) && !isset($map['title'])) {
            throw new \InvalidArgumentException('The file must include Item Code or Item Name.');
        }

        $items = [];
        for ($i = $headerIndex + 1; $i < count($matrix); $i++) {
            $row = $matrix[$i];
            if ($this->rowEmpty($row)) {
                continue;
            }

            $title = $this->cell($row, $map['title'] ?? null);
            $itemCode = $this->cell($row, $map['item_code'] ?? null);
            if ($title === '' && $itemCode === '') {
                continue;
            }

            $need3m = $this->parseNeed($this->cell($row, $map['need_3m'] ?? null));
            $need6m = $this->parseNeed($this->cell($row, $map['need_6m'] ?? null));
            $need1y = $this->parseNeed($this->cell($row, $map['need_1y'] ?? null));

            $items[] = [
                'item_id' => null,
                'item_code' => $itemCode,
                'title' => $title !== '' ? $title : $itemCode,
                'size' => $this->cell($row, $map['size'] ?? null),
                'current_qty' => $this->parseNeed($this->cell($row, $map['current_qty'] ?? null)),
                'amc' => $this->parseDecimal($this->cell($row, $map['amc'] ?? null)),
                'need_3m' => $need3m,
                'need_6m' => $need6m,
                'need_1y' => $need1y,
                'method' => $this->cell($row, $map['method'] ?? null),
                'requested_qty' => $need3m,
            ];
        }

        if (!$items) {
            throw new \InvalidArgumentException('No item rows were found in the uploaded file.');
        }

        return $items;
    }

    private function findHeaderRow(array $matrix): ?int
    {
        foreach ($matrix as $index => $row) {
            $joined = strtolower(implode(' ', $row));
            if (str_contains($joined, 'item') && (str_contains($joined, 'need') || str_contains($joined, 'amc'))) {
                return $index;
            }
        }

        return isset($matrix[0]) ? 0 : null;
    }

    private function mapHeaders(array $headers): array
    {
        $map = [];

        foreach ($headers as $index => $header) {
            $key = $this->normalizeHeader((string) $header);
            if ($key === '') {
                continue;
            }

            if (str_contains($key, 'item code') || $key === 'code') {
                $map['item_code'] = $index;
            } elseif (str_contains($key, 'item name') || $key === 'item' || str_contains($key, 'description')) {
                $map['title'] = $index;
            } elseif ($key === 'size') {
                $map['size'] = $index;
            } elseif (str_contains($key, 'current') && str_contains($key, 'qty')) {
                $map['current_qty'] = $index;
            } elseif (str_contains($key, 'amc')) {
                $map['amc'] = $index;
            } elseif (str_contains($key, '3 month')) {
                $map['need_3m'] = $index;
            } elseif (str_contains($key, '6 month')) {
                $map['need_6m'] = $index;
            } elseif (str_contains($key, '1 year') || str_contains($key, '12 month')) {
                $map['need_1y'] = $index;
            } elseif ($key === 'method') {
                $map['method'] = $index;
            }
        }

        return $map;
    }

    private function normalizeHeader(string $header): string
    {
        $header = strtolower(trim(preg_replace('/\s+/', ' ', $header)));

        return $header;
    }

    private function cell(array $row, ?int $index): string
    {
        if ($index === null) {
            return '';
        }

        return trim((string) ($row[$index] ?? ''));
    }

    private function rowEmpty(array $row): bool
    {
        foreach ($row as $cell) {
            if (trim((string) $cell) !== '') {
                return false;
            }
        }

        return true;
    }

    public function parseNeed(mixed $value): int
    {
        $text = trim((string) $value);
        if ($text === '' || strcasecmp($text, 'OK') === 0 || strcasecmp($text, '—') === 0) {
            return 0;
        }

        $text = str_replace([',', '+'], '', $text);

        return max(0, (int) round((float) $text));
    }

    public function parseDecimal(mixed $value): float
    {
        $text = trim((string) $value);
        if ($text === '') {
            return 0;
        }

        $text = str_replace(',', '', $text);

        return round((float) $text, 2);
    }
}
