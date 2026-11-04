<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('items') && !Schema::hasColumn('items', 'fundSource')) {
            Schema::table('items', function (Blueprint $table) {
                // Where the item is bought from: "Regular" or "Petty Cash" (Utilities and PA).
                $table->string('fundSource', 30)->nullable()->after('category');
            });
        }

        if (!DB::table('inventories')->where('slug', 'utilities-pa')->exists()) {
            DB::table('inventories')->insert([
                'slug' => 'utilities-pa',
                'name' => 'Utilities and PA',
            ]);
        }

        // Everyone who can see Office Materials can see the new inventory too.
        foreach (['department_permissions' => 'department_id', 'user_permissions' => 'user_id'] as $table => $owner) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            $ownerIds = DB::table($table)
                ->where('page', 'office-materials')
                ->where('ability', 'view')
                ->distinct()
                ->pluck($owner);

            foreach ($ownerIds as $ownerId) {
                $exists = DB::table($table)
                    ->where($owner, $ownerId)
                    ->where('page', 'utilities-pa')
                    ->where('ability', 'view')
                    ->exists();

                if (!$exists) {
                    DB::table($table)->insert([
                        $owner => $ownerId,
                        'page' => 'utilities-pa',
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
                DB::table($table)->where('page', 'utilities-pa')->delete();
            }
        }

        DB::table('inventories')->where('slug', 'utilities-pa')->delete();

        if (Schema::hasTable('items') && Schema::hasColumn('items', 'fundSource')) {
            Schema::table('items', function (Blueprint $table) {
                $table->dropColumn('fundSource');
            });
        }
    }
};
