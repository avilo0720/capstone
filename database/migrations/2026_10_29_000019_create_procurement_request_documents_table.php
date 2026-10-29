<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('procurement_request_documents')) {
            Schema::create('procurement_request_documents', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('procurement_request_id');
                $table->string('original_name');
                $table->string('stored_name');
                $table->string('mime_type', 150)->nullable();
                $table->unsignedBigInteger('size')->default(0);
                $table->unsignedBigInteger('uploaded_by')->nullable();
                $table->timestamps();

                $table->index('procurement_request_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('procurement_request_documents');
    }
};
