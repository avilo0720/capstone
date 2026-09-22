<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['department_permissions', 'user_permissions'] as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            $ownerColumn = $table === 'department_permissions' ? 'department_id' : 'user_id';

            // edit → add
            $editOwners = DB::table($table)
                ->where('page', 'procurement')
                ->where('ability', 'edit')
                ->pluck($ownerColumn)
                ->unique();

            foreach ($editOwners as $ownerId) {
                $this->ensure($table, $ownerColumn, $ownerId, 'add');
            }

            // Former reviewers could delete; map review → delete
            $reviewOwners = DB::table($table)
                ->where('page', 'procurement')
                ->where('ability', 'review')
                ->pluck($ownerColumn)
                ->unique();

            foreach ($reviewOwners as $ownerId) {
                $this->ensure($table, $ownerColumn, $ownerId, 'delete');
            }

            DB::table($table)
                ->where('page', 'procurement')
                ->whereIn('ability', [
                    'edit',
                    'dept_review',
                    'dept_review',
                    'check',
                    'final_approve',
                    'final_approve',
                    'review',
                ])
                ->delete();
        }
    }

    public function down(): void
    {
        foreach (['department_permissions', 'user_permissions'] as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            $ownerColumn = $table === 'department_permissions' ? 'department_id' : 'user_id';

            $addOwners = DB::table($table)
                ->where('page', 'procurement')
                ->where('ability', 'add')
                ->pluck($ownerColumn)
                ->unique();

            foreach ($addOwners as $ownerId) {
                $this->ensure($table, $ownerColumn, $ownerId, 'edit');
            }

            $deleteOwners = DB::table($table)
                ->where('page', 'procurement')
                ->where('ability', 'delete')
                ->pluck($ownerColumn)
                ->unique();

            foreach ($deleteOwners as $ownerId) {
                $this->ensure($table, $ownerColumn, $ownerId, 'review');
            }

            DB::table($table)
                ->where('page', 'procurement')
                ->whereIn('ability', ['add', 'delete'])
                ->delete();
        }
    }

    private function ensure(string $table, string $ownerColumn, $ownerId, string $ability): void
    {
        $exists = DB::table($table)
            ->where($ownerColumn, $ownerId)
            ->where('page', 'procurement')
            ->where('ability', $ability)
            ->exists();

        if ($exists) {
            return;
        }

        DB::table($table)->insert([
            $ownerColumn => $ownerId,
            'page' => 'procurement',
            'ability' => $ability,
        ]);
    }
};
