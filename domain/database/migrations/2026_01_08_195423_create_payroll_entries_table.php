<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_entries', function (Blueprint $table) {
            $table->id();
            $table->string('employee_name', 255);
            $table->decimal('salary_amount', 15, 2);
            $table->date('payroll_date')->index();
            $table->text('description')->nullable();
            $table->string('status', 20)->default('accrued')->comment('accrued, paid')->index();
            $table->date('payment_date')->nullable();
            $table->dateTime('paid_at')->nullable();
            $table->timestamps();
            
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_entries');
    }
};
