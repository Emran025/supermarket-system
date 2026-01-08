<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('batch_items', function (Blueprint $table) {
            $table->id();
            $table->integer('item_index');
            $table->string('status', 20)->default('pending')->comment('pending, success, error')->index();
            $table->unsignedBigInteger('reference_id')->nullable()->comment('ID of created record');
            $table->string('voucher_number', 50)->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();
            
            $table->foreignId('batch_id')->constrained('batch_processing')->onDelete('cascade')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('batch_items');
    }
};
