<?php

declare(strict_types=1);

namespace App\Core;

abstract class Controller
{
    /**
     * Send a JSON response.
     */
    protected function jsonResponse(mixed $data, int $statusCode = 200): void
    {
        header('Content-Type: application/json');
        http_response_code($statusCode);
        echo json_encode($data);
        exit;
    }

    /**
     * Send an Error response.
     */
    protected function errorResponse(string $message, int $statusCode = 400, array $errors = []): void
    {
        $response = ['error' => $message];
        if (!empty($errors)) {
            $response['details'] = $errors;
        }
        $this->jsonResponse($response, $statusCode);
    }

    /**
     * Render a view (Basic implementation).
     */
    protected function view(string $viewPath, array $data = []): void
    {
        extract($data);
        $fullPath = dirname(__DIR__, 2) . "/public/views/{$viewPath}.html"; // Assuming simple HTML or PHP views
        
        if (file_exists($fullPath)) {
            require $fullPath;
        } else {
            // Fallback for .php views if .html not found, or error
            $phpPath = dirname(__DIR__, 2) . "/public/views/{$viewPath}.php";
            if (file_exists($phpPath)) {
                require $phpPath;
            } else {
                throw new \RuntimeException("View not found: {$viewPath}");
            }
        }
    }
}
