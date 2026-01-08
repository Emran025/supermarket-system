<?php
require_once __DIR__ . '/src/config/db.php';
try {
    init_database();
    echo "Database migrated successfully.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
