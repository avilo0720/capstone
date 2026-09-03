<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('inventories')) {
            Schema::create('inventories', function (Blueprint $table) {
                $table->id();
                $table->string('slug')->unique();
                $table->string('name');
            });
        }

        $stockId = DB::table('inventories')->where('slug', 'stock-materials')->value('id');
        if (!$stockId) {
            $stockId = DB::table('inventories')->insertGetId([
                'slug' => 'stock-materials',
                'name' => 'Stock Materials',
            ]);
        }

        if (!DB::table('inventories')->where('slug', 'office-materials')->exists()) {
            DB::table('inventories')->insert([
                'slug' => 'office-materials',
                'name' => 'Office Materials',
            ]);
        }

        if (Schema::hasTable('items') && !Schema::hasColumn('items', 'inventory_id')) {
            Schema::table('items', function (Blueprint $table) {
                $table->unsignedBigInteger('inventory_id')->nullable()->after('id');
                $table->index('inventory_id');
            });

            DB::table('items')->whereNull('inventory_id')->update(['inventory_id' => $stockId]);
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('items') && Schema::hasColumn('items', 'inventory_id')) {
            Schema::table('items', function (Blueprint $table) {
                $table->dropIndex(['inventory_id']);
                $table->dropColumn('inventory_id');
            });
        }

        Schema::dropIfExists('inventories');
    }
};
