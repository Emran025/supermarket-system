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
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->foreignId('category_id')->nullable()->constrained('categories')->onDelete('set null');
            $table->decimal('unit_price', 10, 2)->default(0.00);
            $table->decimal('minimum_profit_margin', 10, 2)->default(0.00);
            $table->integer('stock_quantity')->default(0);
            $table->string('unit_name', 50)->default('كرتون');
            $table->integer('items_per_unit')->default(1);
            $table->string('sub_unit_name', 50)->nullable()->default('حبة');
            $table->decimal('weighted_average_cost', 10, 2)->default(0.00);
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
