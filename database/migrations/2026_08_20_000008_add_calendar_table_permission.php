<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->copyViewToTable('department_permissions', 'department_id');
        $this->copyViewToTable('user_permissions', 'user_id');
    }

    public function down(): void
    {
        DB::table('department_permissions')
            ->where('page', 'calendar')
            ->where('ability', 'table')
            ->delete();

        DB::table('user_permissions')
            ->where('page', 'calendar')
            ->where('ability', 'table')
            ->delete();
    }

    private function copyViewToTable(string $table, string $ownerColumn): void
    {
        if (!Schema::hasTable($table)) {
            return;
        }

        $viewRows = DB::table($table)
            ->where('page', 'calendar')
            ->where('ability', 'view')
            ->get();

        foreach ($viewRows as $row) {
            $exists = DB::table($table)
                ->where($ownerColumn, $row->{$ownerColumn})
                ->where('page', 'calendar')
                ->where('ability', 'table')
                ->exists();

            if ($exists) {
                continue;
            }

            DB::table($table)->insert([
                $ownerColumn => $row->{$ownerColumn},
                'page' => 'calendar',
                'ability' => 'table',
            ]);
        }
    }
};
