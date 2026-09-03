<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->grant('department_permissions', 'department_id');
        $this->grant('user_permissions', 'user_id');
    }

    public function down(): void
    {
        foreach (['department_permissions', 'user_permissions'] as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            DB::table($table)
                ->where('page', 'procurement')
                ->whereIn('ability', ['view', 'edit', 'review'])
                ->delete();
        }
    }

    private function grant(string $table, string $ownerColumn): void
    {
        if (!Schema::hasTable($table)) {
            return;
        }

        $ownerIds = DB::table($table)
            ->where('page', 'forecast')
            ->where('ability', 'view')
            ->pluck($ownerColumn)
            ->unique();

        foreach ($ownerIds as $ownerId) {
            $this->ensure($table, $ownerColumn, $ownerId, 'view');
            $this->ensure($table, $ownerColumn, $ownerId, 'edit');

            $canReview = DB::table($table)
                ->where($ownerColumn, $ownerId)
                ->where(function ($q) {
                    $q->where(function ($inner) {
                        $inner->where('page', 'reports')->where('ability', 'view');
                    })->orWhere(function ($inner) {
                        $inner->where('page', 'users')->whereIn('ability', ['view', 'manage']);
                    });
                })
                ->exists();

            if ($canReview) {
                $this->ensure($table, $ownerColumn, $ownerId, 'review');
            }
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
