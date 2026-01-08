<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_counts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->onDelete('cascade')->index();
            $table->foreignId('fiscal_period_id')->constrained('fiscal_periods')->onDelete('restrict')->index();
            $table->date('count_date');
            $table->integer('book_quantity')->comment('Quantity from perpetual system');
            $table->integer('counted_quantity')->comment('Physical count');
            $table->integer('variance')->comment('counted - book');
            $table->text('notes')->nullable();
            $table->boolean('is_processed')->default(false)->index();
            $table->dateTime('processed_at')->nullable();
            $table->foreignId('counted_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_counts');
    }
};
