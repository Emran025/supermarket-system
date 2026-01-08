<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reconciliations', function (Blueprint $table) {
            $table->id();
            $table->string('account_code', 20)->index();
            $table->date('reconciliation_date')->index();
            $table->decimal('ledger_balance', 15, 2);
            $table->decimal('physical_balance', 15, 2);
            $table->decimal('difference', 15, 2);
            $table->string('status', 20)->default('unreconciled')->comment('reconciled, unreconciled, adjusted')->index();
            $table->text('notes')->nullable();
            $table->text('adjustment_notes')->nullable();
            $table->foreignId('reconciled_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reconciliations');
    }
};
