<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('procurement_requests')) {
            return;
        }

        Schema::table('procurement_requests', function (Blueprint $table) {
            if (!Schema::hasColumn('procurement_requests', 'assigned_to')) {
                $table->unsignedBigInteger('assigned_to')->nullable()->after('uploaded_by');
                $table->index('assigned_to');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('procurement_requests')) {
            return;
        }

        Schema::table('procurement_requests', function (Blueprint $table) {
            if (Schema::hasColumn('procurement_requests', 'assigned_to')) {
                $table->dropIndex(['assigned_to']);
                $table->dropColumn('assigned_to');
            }
        });
    }
};
