<?php

namespace App\Services;

use App\Models\Item;
use App\Models\ProcurementRequest;
use App\Models\Transaction;
use App\Support\ActivityChangeSet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class ProcurementStockService
{
    public function __construct(private ActivityLogger $activity)
    {
    }

    /**
     * @param  array<int, int>  $qtyByLineId
     */
    public function apply(
        Request $http,
        ProcurementRequest $procurement,
        array $qtyByLineId,
        string $status,
        string $action,
        string $description,
    ): void {
        if ($procurement->stockAlreadyApplied()) {
            throw new InvalidArgumentException('Stock for this request was already added to inventory.');
        }

        if (!$procurement->isPending()) {
            throw new InvalidArgumentException('Only pending requests can receive stock.');
        }

        DB::transaction(function () use ($http, $procurement, $qtyByLineId, $status, $action, $description) {
            $now = now();
            $sessionUser = $http->session()->get('user');
            $appliedAny = false;
            $changeRows = [];

            foreach ($procurement->items()->lockForUpdate()->get() as $line) {
                $qty = (int) ($qtyByLineId[$line->id] ?? 0);
                if ($qty < 0) {
                    throw new InvalidArgumentException('Stock quantity cannot be negative.');
                }

                if ($qty === 0) {
                    $line->update(['applied_qty' => 0]);
                    continue;
                }

                if (!$line->item_id) {
                    throw new InvalidArgumentException(
                        'Cannot apply stock for "'.$line->title.'" because it is not linked to an inventory item.'
                    );
                }

                $item = Item::query()
                    ->where('id', $line->item_id)
                    ->where('inventory_id', $procurement->inventory_id)
                    ->lockForUpdate()
                    ->first();

                if (!$item) {
                    throw new InvalidArgumentException('Inventory item not found for "'.$line->title.'".');
                }

                $previous = (int) $item->quantity;
                $newQuantity = $previous + $qty;

                $item->update([
                    'quantity' => $newQuantity,
                    'updated' => $now,
                ]);

                Transaction::create([
                    'itemId' => $item->id,
                    'action' => 'add',
                    'quantity' => $qty,
                    'transactionDate' => $now,
                    'created_at' => $now,
                ]);

                $line->update(['applied_qty' => $qty]);
                $appliedAny = true;
                $changeRows[] = [
                    'field' => $item->title,
                    'from' => (string) $previous,
                    'to' => (string) $newQuantity,
                ];
            }

            if (!$appliedAny) {
                throw new InvalidArgumentException('Enter at least one stock quantity greater than zero.');
            }

            $procurement->update([
                'status' => $status,
                'reviewed_by' => $sessionUser['id'] ?? null,
                'reviewed_at' => $now,
                'stock_applied_at' => $now,
                'rejection_reason' => null,
            ]);

            $this->activity->log(
                $http,
                $action,
                $description,
                'procurement_request',
                (int) $procurement->id,
                [
                    'status' => $status,
                    'changes' => $changeRows ?: ActivityChangeSet::snapshot(
                        ['status' => $status],
                        ['status' => 'Status']
                    ),
                ]
            );
        });
    }

    /**
     * @return array<int, int>
     */
    public function requestedQtyMap(ProcurementRequest $procurement): array
    {
        $map = [];
        foreach ($procurement->items as $line) {
            $map[$line->id] = (int) $line->requested_qty;
        }

        return $map;
    }
}
