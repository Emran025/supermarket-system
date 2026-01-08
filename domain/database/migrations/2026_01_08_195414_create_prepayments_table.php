<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prepayments', function (Blueprint $table) {
            $table->id();
            $table->string('description', 255);
            $table->decimal('total_amount', 15, 2);
            $table->date('payment_date')->index();
            $table->string('expense_account_code', 20);
            $table->integer('amortization_periods')->default(1);
            $table->decimal('amortized_amount', 15, 2)->default(0.00);
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prepayments');
    }
};
