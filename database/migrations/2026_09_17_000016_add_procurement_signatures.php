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
            if (!Schema::hasColumn('procurement_requests', 'requested_signature')) {
                $table->string('requested_signature')->nullable()->after('uploaded_by');
            }
            if (!Schema::hasColumn('procurement_requests', 'noted_signature')) {
                $table->string('noted_signature')->nullable()->after('noted_at');
            }
            if (!Schema::hasColumn('procurement_requests', 'checked_signature')) {
                $table->string('checked_signature')->nullable()->after('checked_at');
            }
            if (!Schema::hasColumn('procurement_requests', 'approved_signature')) {
                $table->string('approved_signature')->nullable()->after('approved_at');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('procurement_requests')) {
            return;
        }

        Schema::table('procurement_requests', function (Blueprint $table) {
            foreach (['requested_signature', 'noted_signature', 'checked_signature', 'approved_signature'] as $column) {
                if (Schema::hasColumn('procurement_requests', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
