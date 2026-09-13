<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('issuance_requests')) {
            Schema::create('issuance_requests', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('inventory_id');
                $table->string('status', 32)->default('pending');
                $table->string('source', 32)->default('upload');
                $table->string('original_filename')->nullable();
                $table->string('amc_mode')->nullable();
                $table->unsignedBigInteger('uploaded_by')->nullable();
                $table->unsignedBigInteger('reviewed_by')->nullable();
                $table->dateTime('reviewed_at')->nullable();
                $table->text('rejection_reason')->nullable();
                $table->text('previous_rejection_reason')->nullable();
                $table->dateTime('stock_applied_at')->nullable();
                $table->timestamps();

                $table->index(['inventory_id', 'status']);
            });
        }

        if (!Schema::hasTable('issuance_request_items')) {
            Schema::create('issuance_request_items', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('issuance_request_id');
                $table->unsignedBigInteger('item_id')->nullable();
                $table->string('item_code')->nullable();
                $table->string('title');
                $table->string('size')->nullable();
                $table->integer('current_qty')->default(0);
                $table->decimal('amc', 12, 2)->default(0);
                $table->integer('need_3m')->default(0);
                $table->integer('need_6m')->default(0);
                $table->integer('need_1y')->default(0);
                $table->string('method')->nullable();
                $table->integer('requested_qty')->default(0);
                $table->integer('applied_qty')->nullable();
                $table->timestamps();

                $table->index('issuance_request_id');
                $table->index('item_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('issuance_request_items');
        Schema::dropIfExists('issuance_requests');
    }
};
