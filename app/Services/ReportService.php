<?php

namespace App\Services;

class ReportService
{
    public function roundHalfDown(float $value): int
    {
        $sign = $value < 0 ? -1 : 1;
        $absVal = abs($value);
        $floor = floor($absVal);
        $fraction = $absVal - $floor;

        if ($fraction > 0.5) {
            return (int) ($sign * ($floor + 1));
        }

        return (int) ($sign * $floor);
    }

    public function buildSummary(array $items): array
    {
        $totalItems = count($items);
        $totalQuantity = 0;
        $totalValue = 0.0;
        $totalDemand = 0;
        $lowStockItems = [];
        $cumulativeDemand = 0;

        foreach ($items as $item) {
            $totalQuantity += (int) ($item['quantity'] ?? 0);
            $totalValue += ((float) ($item['price'] ?? 0)) * ((int) ($item['quantity'] ?? 0));
            $totalDemand += (int) ($item['monthlyDemand'] ?? 0);
        }

        foreach ($items as $item) {
            $amc = (int) ($item['monthlyDemand'] ?? 0);
            $stock = (int) ($item['quantity'] ?? 0);
            $price = (float) ($item['price'] ?? 0);

            $cumulativeDemand += $amc;
            $cumulativePercent = $totalDemand === 0 ? 0 : $cumulativeDemand / $totalDemand;
            $fsn = $cumulativePercent <= 0.2 ? 'N' : ($cumulativePercent < 0.7 ? 'S' : 'F');

            $leadTimeDemand = $amc * 3.495065789473684;
            $ltd = $this->roundHalfDown($leadTimeDemand);
            $safetyStock = ($amc + $leadTimeDemand) * 0.1;
            $ss = $this->roundHalfDown($safetyStock);
            $rop = $ltd + $ss;
            $msl = $fsn === 'N' && $stock < 3 ? 3 : ($amc + $leadTimeDemand + $safetyStock);

            $triggerPoint = (
                ($rop > $stock && ($fsn === 'F' || $fsn === 'S')) ||
                ($fsn === 'N' && $stock < 3)
            ) ? 'RS Needed' : 'Sufficient';

            if ($triggerPoint === 'RS Needed') {
                $roundedMsl = (int) round($msl);
                $deficit = $roundedMsl - $stock;
                $urgency = $stock === 0
                    ? 'critical'
                    : ($stock <= (int) ceil($roundedMsl * 0.25) ? 'high' : 'medium');

                $lowStockItems[] = [
                    'id' => $item['id'],
                    'itemCode' => $item['itemCode'],
                    'title' => $item['title'],
                    'size' => $item['size'],
                    'currentStock' => $stock,
                    'reorderPoint' => $rop,
                    'minimumStockLevel' => $roundedMsl,
                    'deficit' => $deficit,
                    'unitCost' => $price,
                    'restockCost' => $deficit * $price,
                    'fsn' => $fsn,
                    'urgency' => $urgency,
                    'triggerPoint' => $triggerPoint,
                ];
            }
        }

        return [
            'totalItems' => $totalItems,
            'totalQuantity' => $totalQuantity,
            'totalValue' => round($totalValue, 2),
            'lowStockCount' => count($lowStockItems),
            'lowStockItems' => $lowStockItems,
        ];
    }
}
