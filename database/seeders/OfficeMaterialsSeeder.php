<?php

namespace Database\Seeders;

use App\Models\Inventory;
use App\Models\Item;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class OfficeMaterialsSeeder extends Seeder
{
    public function run(): void
    {
        $office = Inventory::query()->where('slug', 'office-materials')->first();
        if (!$office) {
            $office = Inventory::create([
                'slug' => 'office-materials',
                'name' => 'Office Materials',
            ]);
        }

        $existingIds = Item::query()->where('inventory_id', $office->id)->pluck('id');
        if ($existingIds->isNotEmpty()) {
            Transaction::query()->whereIn('itemId', $existingIds)->delete();
            Item::query()->where('inventory_id', $office->id)->delete();
        }

        $catalog = [
            ['title' => 'Bond Paper', 'size' => 'A4 70gsm', 'price' => 185.00, 'amc' => 18],
            ['title' => 'Bond Paper', 'size' => 'Legal 70gsm', 'price' => 195.00, 'amc' => 8],
            ['title' => 'Ballpen Black', 'size' => 'box/12', 'price' => 85.00, 'amc' => 10],
            ['title' => 'Ballpen Blue', 'size' => 'box/12', 'price' => 85.00, 'amc' => 6],
            ['title' => 'Sign Pen', 'size' => 'pc', 'price' => 25.00, 'amc' => 12],
            ['title' => 'Pencil #2', 'size' => 'box/12', 'price' => 60.00, 'amc' => 4],
            ['title' => 'Highlighter Assorted', 'size' => 'set/4', 'price' => 95.00, 'amc' => 3],
            ['title' => 'Permanent Marker', 'size' => 'pc', 'price' => 35.00, 'amc' => 5],
            ['title' => 'Correction Tape', 'size' => 'pc', 'price' => 28.00, 'amc' => 8],
            ['title' => 'Stapler Standard', 'size' => 'pc', 'price' => 150.00, 'amc' => 1],
            ['title' => 'Staple Wire #35', 'size' => 'box', 'price' => 22.00, 'amc' => 4],
            ['title' => 'Paper Clip', 'size' => '33mm box', 'price' => 18.00, 'amc' => 3],
            ['title' => 'Fastener Plastic', 'size' => 'box', 'price' => 45.00, 'amc' => 3],
            ['title' => 'Folder Ordinary', 'size' => 'pc', 'price' => 12.00, 'amc' => 25],
            ['title' => 'Expanded Folder', 'size' => 'pc', 'price' => 35.00, 'amc' => 10],
            ['title' => 'Brown Envelope', 'size' => 'long', 'price' => 4.00, 'amc' => 30],
            ['title' => 'Expanding Envelope', 'size' => 'pc', 'price' => 18.00, 'amc' => 6],
            ['title' => 'Record Book', 'size' => '300 pages', 'price' => 85.00, 'amc' => 2],
            ['title' => 'Sticky Notes', 'size' => '3x3 pad', 'price' => 45.00, 'amc' => 5],
            ['title' => 'Transparent Tape', 'size' => '1" roll', 'price' => 28.00, 'amc' => 4],
            ['title' => 'Glue Stick', 'size' => 'pc', 'price' => 32.00, 'amc' => 3],
            ['title' => 'Scissors', 'size' => 'pc', 'price' => 55.00, 'amc' => 1],
            ['title' => 'Puncher Heavy Duty', 'size' => 'pc', 'price' => 280.00, 'amc' => 1],
            ['title' => 'Calculator 12-digit', 'size' => 'pc', 'price' => 350.00, 'amc' => 1],
            ['title' => 'Printer Ink Black', 'size' => 'HP 680', 'price' => 650.00, 'amc' => 2],
            ['title' => 'Printer Ink Color', 'size' => 'HP 680', 'price' => 680.00, 'amc' => 2],
            ['title' => 'Copier Toner', 'size' => 'cartridge', 'price' => 4200.00, 'amc' => 1],
            ['title' => 'Alcohol 70%', 'size' => '500ml', 'price' => 75.00, 'amc' => 6],
            ['title' => 'Tissue Roll', 'size' => 'pack/12', 'price' => 95.00, 'amc' => 3],
            ['title' => 'Trash Bag Large', 'size' => 'pack/20', 'price' => 85.00, 'amc' => 2],
            ['title' => 'Battery AA', 'size' => 'pack/4', 'price' => 120.00, 'amc' => 3],
            ['title' => 'USB Flash Drive', 'size' => '32GB', 'price' => 450.00, 'amc' => 1],
            ['title' => 'ID Lace', 'size' => 'pc', 'price' => 25.00, 'amc' => 4],
            ['title' => 'Stamp Pad', 'size' => 'pc', 'price' => 45.00, 'amc' => 1],
            ['title' => 'Manila Paper', 'size' => 'pc', 'price' => 8.00, 'amc' => 8],
        ];

        mt_srand(20260820);
        $now = Carbon::parse('2026-08-20 12:00:00');
        $start = Carbon::parse('2026-01-05');
        $end = Carbon::parse('2026-08-19');

        DB::transaction(function () use ($catalog, $office, $start, $end, $now) {
            foreach ($catalog as $index => $row) {
                $amc = (int) $row['amc'];
                $item = Item::create([
                    'inventory_id' => $office->id,
                    'itemCode' => 'OFF-'.($index + 1),
                    'title' => $row['title'],
                    'size' => $row['size'],
                    'category' => null,
                    'quantity' => 0,
                    'price' => $row['price'],
                    'monthlyDemand' => $amc,
                    'updated' => $now,
                ]);

                $stock = max($amc * 4, 8);
                $restockQty = max($amc * 2, 4);
                $useChance = min(0.55, $amc / 20);
                $useSize = max(1, (int) ceil($amc / 10));

                $cursor = $start->copy();
                while ($cursor->lte($end)) {
                    $isWeekday = $cursor->isWeekday();
                    $roll = mt_rand(1, 1000) / 1000;

                    if ($isWeekday && $roll < 0.08 && $stock < $amc * 2) {
                        $addQty = $restockQty;
                        $stock += $addQty;
                        Transaction::create([
                            'itemId' => $item->id,
                            'action' => 'add',
                            'quantity' => $addQty,
                            'transactionDate' => $cursor->copy()->setTime(8, 0, 0),
                            'created_at' => $cursor->copy()->setTime(8, 0, 0),
                        ]);
                    }

                    if ($isWeekday && $roll < $useChance) {
                        $qty = mt_rand(1, $useSize);
                        if ($qty > $stock) {
                            $addQty = $restockQty;
                            $stock += $addQty;
                            Transaction::create([
                                'itemId' => $item->id,
                                'action' => 'add',
                                'quantity' => $addQty,
                                'transactionDate' => $cursor->copy()->setTime(8, 30, 0),
                                'created_at' => $cursor->copy()->setTime(8, 30, 0),
                            ]);
                        }

                        $qty = min($qty, $stock);
                        if ($qty >= 1) {
                            $stock -= $qty;
                            Transaction::create([
                                'itemId' => $item->id,
                                'action' => 'use',
                                'quantity' => $qty,
                                'transactionDate' => $cursor->copy()->setTime(12, 0, 0),
                                'created_at' => $cursor->copy()->setTime(12, 0, 0),
                            ]);
                        }
                    }

                    $cursor->addDay();
                }

                $item->update([
                    'quantity' => $stock,
                    'updated' => $now,
                ]);
            }
        });
    }
}
