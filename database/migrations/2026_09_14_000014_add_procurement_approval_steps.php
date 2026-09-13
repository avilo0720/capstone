<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('procurement_requests')) {
            Schema::table('procurement_requests', function (Blueprint $table) {
                if (!Schema::hasColumn('procurement_requests', 'rs_number')) {
                    $table->string('rs_number', 40)->nullable()->after('id');
                }
                if (!Schema::hasColumn('procurement_requests', 'department_id')) {
                    $table->unsignedBigInteger('department_id')->nullable()->after('inventory_id');
                }
                if (!Schema::hasColumn('procurement_requests', 'destination')) {
                    $table->string('destination')->nullable()->after('amc_mode');
                }
                if (!Schema::hasColumn('procurement_requests', 'purpose')) {
                    $table->text('purpose')->nullable()->after('destination');
                }
                if (!Schema::hasColumn('procurement_requests', 'date_needed')) {
                    $table->date('date_needed')->nullable()->after('purpose');
                }
                if (!Schema::hasColumn('procurement_requests', 'noted_by')) {
                    $table->unsignedBigInteger('noted_by')->nullable()->after('reviewed_at');
                }
                if (!Schema::hasColumn('procurement_requests', 'noted_at')) {
                    $table->dateTime('noted_at')->nullable()->after('noted_by');
                }
                if (!Schema::hasColumn('procurement_requests', 'checked_by')) {
                    $table->unsignedBigInteger('checked_by')->nullable()->after('noted_at');
                }
                if (!Schema::hasColumn('procurement_requests', 'checked_at')) {
                    $table->dateTime('checked_at')->nullable()->after('checked_by');
                }
                if (!Schema::hasColumn('procurement_requests', 'approved_by')) {
                    $table->unsignedBigInteger('approved_by')->nullable()->after('checked_at');
                }
                if (!Schema::hasColumn('procurement_requests', 'approved_at')) {
                    $table->dateTime('approved_at')->nullable()->after('approved_by');
                }
                if (!Schema::hasColumn('procurement_requests', 'printed_at')) {
                    $table->dateTime('printed_at')->nullable()->after('approved_at');
                }
            });

            $existing = DB::table('procurement_requests')->whereNull('rs_number')->get(['id', 'created_at']);
            foreach ($existing as $row) {
                $stamp = $row->created_at ? date('Y-m', strtotime((string) $row->created_at)) : date('Y-m');
                DB::table('procurement_requests')->where('id', $row->id)->update([
                    'rs_number' => sprintf('NB-%s-%05d', $stamp, $row->id),
                ]);
            }
        }

        $this->grantStepAbilities('department_permissions', 'department_id');
        $this->grantStepAbilities('user_permissions', 'user_id');
    }

    public function down(): void
    {
        foreach (['department_permissions', 'user_permissions'] as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }
            DB::table($table)
                ->where('page', 'procurement')
                ->whereIn('ability', ['dept_review', 'check', 'final_approve'])
                ->delete();
        }

        if (Schema::hasTable('procurement_requests')) {
            Schema::table('procurement_requests', function (Blueprint $table) {
                foreach ([
                    'rs_number', 'department_id', 'destination', 'purpose', 'date_needed',
                    'noted_by', 'noted_at', 'checked_by', 'checked_at',
                    'approved_by', 'approved_at', 'printed_at',
                ] as $column) {
                    if (Schema::hasColumn('procurement_requests', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }

    private function grantStepAbilities(string $table, string $ownerColumn): void
    {
        if (!Schema::hasTable($table)) {
            return;
        }

        $ownerIds = DB::table($table)
            ->where('page', 'procurement')
            ->where('ability', 'review')
            ->pluck($ownerColumn)
            ->unique();

        foreach ($ownerIds as $ownerId) {
            foreach (['dept_review', 'check', 'final_approve'] as $ability) {
                $exists = DB::table($table)
                    ->where($ownerColumn, $ownerId)
                    ->where('page', 'procurement')
                    ->where('ability', $ability)
                    ->exists();
                if ($exists) {
                    continue;
                }
                DB::table($table)->insert([
                    $ownerColumn => $ownerId,
                    'page' => 'procurement',
                    'ability' => $ability,
                ]);
            }
        }
    }
};
