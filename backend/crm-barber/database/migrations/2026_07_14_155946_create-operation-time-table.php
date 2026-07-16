<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('operation_times', function (Blueprint $table) {
            $table->id();
            $table->date('day_of_week');
            $table->time('start_time');
            $table->time('end_time');
            $table->time('waiting_start');
            $table->time('waiting_end');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('operation_times');
    }
};
