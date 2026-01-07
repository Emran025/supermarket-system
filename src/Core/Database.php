<?php

declare(strict_types=1);

namespace App\Core;

use PDO;
use PDOException;
use Exception;
use RuntimeException;

class Database
{
    private static ?Database $instance = null;
    private PDO $pdo;

    private function __construct()
    {
        // Ensure config is loaded
        if (!defined('DB_HOST')) {
            $configPath = dirname(__DIR__) . '/config/config.php';
            if (file_exists($configPath)) {
                require_once $configPath;
            } else {
                // Fallback or throw error if config missing
                throw new RuntimeException("Configuration file not found.");
            }
        }

        $dsn = sprintf(
            "mysql:host=%s;dbname=%s;charset=utf8mb4",
            DB_HOST,
            DB_NAME
        );

        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_PERSISTENT         => true, // Use persistent connections for performance
        ];

        try {
            $this->pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            // Log error safely without exposing credentials in production/stack trace
            error_log("Database Connection Error: " . $e->getMessage());
            throw new RuntimeException("Database connection failed. Please check logs.");
        }
    }

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getConnection(): PDO
    {
        return $this->pdo;
    }

    // Magic method cloning protection
    private function __clone() {}

    public function __wakeup()
    {
        throw new Exception("Cannot unserialize a singleton.");
    }
}
