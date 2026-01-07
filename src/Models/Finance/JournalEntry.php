<?php

declare(strict_types=1);

namespace App\Models\Finance;

use App\Core\Model;

class JournalEntry extends Model
{
    protected string $table = 'journal_entries';

    /**
     * specific method to create a header and return ID 
     * (inherits generic create, but we can type hint more specifically if needed)
     */
    public function createHeader(string $description, string $date, ?int $createdBy = null): int
    {
        return (int) $this->create([
            'description' => $description,
            'entry_date' => $date,
            'created_by' => $createdBy
        ]);
    }
}
