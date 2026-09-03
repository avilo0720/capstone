<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->grantDatasets('department_permissions', 'department_id');
        $this->grantDatasets('user_permissions', 'user_id');
    }

    public function down(): void
    {
        foreach (['department_permissions', 'user_permissions'] as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            DB::table($table)
                ->whereIn('page', ['stock-materials', 'office-materials'])
                ->where('ability', 'view')
                ->delete();
        }
    }

    private function grantDatasets(string $table, string $ownerColumn): void
    {
        if (!Schema::hasTable($table)) {
            return;
        }

        $ownerIds = DB::table($table)->distinct()->pluck($ownerColumn);

        foreach ($ownerIds as $ownerId) {
            foreach (['stock-materials', 'office-materials'] as $page) {
                $exists = DB::table($table)
                    ->where($ownerColumn, $ownerId)
                    ->where('page', $page)
                    ->where('ability', 'view')
                    ->exists();

                if ($exists) {
                    continue;
                }

                DB::table($table)->insert([
                    $ownerColumn => $ownerId,
                    'page' => $page,
                    'ability' => 'view',
                ]);
            }
        }
    }
};
