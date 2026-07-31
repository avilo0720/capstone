<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('calendar_notes')) {
            return;
        }

        if (!Schema::hasColumn('calendar_notes', 'end_date')) {
            Schema::table('calendar_notes', function (Blueprint $table) {
                $table->date('end_date')->nullable()->after('note_date');
                $table->index(['end_date']);
            });
        }

        DB::table('calendar_notes')
            ->whereNull('end_date')
            ->update(['end_date' => DB::raw('note_date')]);
    }

    public function down(): void
    {
        if (!Schema::hasTable('calendar_notes') || !Schema::hasColumn('calendar_notes', 'end_date')) {
            return;
        }

        Schema::table('calendar_notes', function (Blueprint $table) {
            $table->dropIndex(['end_date']);
            $table->dropColumn('end_date');
        });
    }
};
