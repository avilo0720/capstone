<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('calendar_notes')) {
            Schema::create('calendar_notes', function (Blueprint $table) {
                $table->id();
                $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
                $table->string('title', 150);
                $table->text('body')->nullable();
                $table->string('color', 20)->default('blue');
                $table->date('note_date');
                $table->timestamps();
                $table->index(['note_date']);
                $table->index(['created_by', 'note_date']);
            });
        }

        if (!Schema::hasTable('calendar_note_departments')) {
            Schema::create('calendar_note_departments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('calendar_note_id')->constrained('calendar_notes')->cascadeOnDelete();
                $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
                $table->unique(['calendar_note_id', 'department_id'], 'cal_note_dept_unique');
            });
        }

        if (!Schema::hasTable('calendar_note_users')) {
            Schema::create('calendar_note_users', function (Blueprint $table) {
                $table->id();
                $table->foreignId('calendar_note_id')->constrained('calendar_notes')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->unique(['calendar_note_id', 'user_id'], 'cal_note_user_unique');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('calendar_note_users');
        Schema::dropIfExists('calendar_note_departments');
        Schema::dropIfExists('calendar_notes');
    }
};
