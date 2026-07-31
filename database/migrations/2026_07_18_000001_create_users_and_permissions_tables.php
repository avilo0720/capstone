<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('user_permissions');
        Schema::dropIfExists('department_permissions');
        Schema::dropIfExists('users');
        Schema::dropIfExists('departments');

        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->unique();
            $table->text('description')->nullable();
            $table->dateTime('created')->useCurrent();
            $table->dateTime('updated')->useCurrent()->useCurrentOnUpdate();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('username', 100)->unique();
            $table->date('birthday')->nullable();
            $table->string('password');
            $table->string('role', 100);
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->boolean('use_custom_permissions')->default(false);
            $table->dateTime('created')->useCurrent();
            $table->dateTime('updated')->useCurrent()->useCurrentOnUpdate();
        });

        Schema::create('department_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
            $table->string('page', 50);
            $table->string('ability', 50);
            $table->unique(['department_id', 'page', 'ability']);
        });

        Schema::create('user_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('page', 50);
            $table->string('ability', 50);
            $table->unique(['user_id', 'page', 'ability']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_permissions');
        Schema::dropIfExists('department_permissions');
        Schema::dropIfExists('users');
        Schema::dropIfExists('departments');
    }
};
