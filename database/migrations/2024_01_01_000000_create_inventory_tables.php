<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('categories')) {
            Schema::create('categories', function (Blueprint $table) {
                $table->unsignedBigInteger('id')->primary();
                $table->string('title');
                $table->text('description')->nullable();
                $table->dateTime('updated')->nullable();
            });
        }

        if (!Schema::hasTable('items')) {
            Schema::create('items', function (Blueprint $table) {
                $table->id();
                $table->string('itemCode')->nullable();
                $table->string('title');
                $table->string('size')->nullable();
                $table->string('category')->nullable();
                $table->integer('quantity')->default(0);
                $table->decimal('price', 10, 2)->default(0);
                $table->integer('monthlyDemand')->default(0);
                $table->dateTime('updated')->nullable();
            });
        }

        if (!Schema::hasTable('transactions')) {
            Schema::create('transactions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('itemId');
                $table->enum('action', ['add', 'use']);
                $table->integer('quantity')->default(0);
                $table->dateTime('transactionDate')->useCurrent();
                $table->dateTime('created_at')->useCurrent();
                $table->index('transactionDate');
                $table->index('itemId');
            });
        }

        // Users / departments / permissions are created in a dedicated migration.
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('items');
        Schema::dropIfExists('categories');
    }
};
