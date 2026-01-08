<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zatca_einvoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->unique()->constrained('invoices')->onDelete('cascade');
            $table->text('xml_content');
            $table->string('hash', 64)->index();
            $table->text('signed_xml')->nullable();
            $table->string('qr_code', 255)->nullable();
            $table->string('zatca_uuid', 255)->nullable();
            $table->text('zatca_qr_code')->nullable();
            $table->string('status', 20)->default('generated')->comment('generated, signed, submitted, rejected')->index();
            $table->dateTime('signed_at')->nullable();
            $table->dateTime('submitted_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('zatca_einvoices');
    }
};
