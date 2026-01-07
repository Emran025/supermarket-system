<?php
// Backwards-compatible wrapper for legacy controller includes
// Some controllers require "../LedgerService.php" (expecting file in src/),
// but the implementation lives in src/Services/LedgerService.php. This file
// keeps those controllers working without changing many files.

require_once __DIR__ . '/Services/LedgerService.php';
