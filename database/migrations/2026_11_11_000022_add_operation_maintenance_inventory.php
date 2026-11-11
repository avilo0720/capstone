<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!DB::table('inventories')->where('slug', 'operation-maintenance')->exists()) {
            DB::table('inventories')->insert([
                'slug' => 'operation-maintenance',
                'name' => 'Operation Maintenance',
            ]);
        }

        // Its first items come from Stock Materials, so everyone who can see that inventory sees this one.
        foreach (['department_permissions' => 'department_id', 'user_permissions' => 'user_id'] as $table => $owner) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            $ownerIds = DB::table($table)
                ->where('page', 'stock-materials')
                ->where('ability', 'view')
                ->distinct()
                ->pluck($owner);

            foreach ($ownerIds as $ownerId) {
                $exists = DB::table($table)
                    ->where($owner, $ownerId)
                    ->where('page', 'operation-maintenance')
                    ->where('ability', 'view')
                    ->exists();

                if (!$exists) {
                    DB::table($table)->insert([
                        $owner => $ownerId,
                        'page' => 'operation-maintenance',
                        'ability' => 'view',
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        foreach (['department_permissions', 'user_permissions'] as $table) {
            if (Schema::hasTable($table)) {
                DB::table($table)->where('page', 'operation-maintenance')->delete();
            }
        }

        DB::table('inventories')->where('slug', 'operation-maintenance')->delete();
    }
};
