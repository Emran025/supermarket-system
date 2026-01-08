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
        Schema::create('purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->onDelete('cascade');
            $table->integer('quantity');
            $table->decimal('invoice_price', 10, 2);
            $table->string('unit_type', 20)->default('sub'); // 'main' or 'sub'
            $table->date('production_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('supplier_id')->nullable()->constrained('ap_suppliers')->onDelete('set null');
            $table->string('voucher_number', 50)->nullable()->index();
            $table->text('notes')->nullable();
            $table->decimal('vat_rate', 5, 2)->default(0.00);
            $table->decimal('vat_amount', 10, 2)->default(0.00);
            $table->string('approval_status', 20)->default('approved'); // pending, approved, rejected
            $table->foreignId('approved_by')->nullable()->constrained('users')->onDelete('set null');
            $table->dateTime('approved_at')->nullable();
            $table->boolean('is_reversed')->default(false);
            $table->dateTime('reversed_at')->nullable();
            $table->foreignId('reversed_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('purchase_date')->useCurrent();
            $table->timestamp('created_at')->useCurrent();
            $table->index('approval_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchases');
    }
};
