<?php

class Router {
    private $routes = [];

    public function register($action, $controllerClass) {
        $this->routes[$action] = $controllerClass;
    }

    public function dispatch() {
        $rawAction = $_GET['action'] ?? '';
        
        // Clean up common prefixes that might leak from frontend routing
        $action = ltrim($rawAction, '/');
        if (strpos($action, 'api/') === 0) {
            $action = substr($action, 4);
        }
        
        if (empty($action)) {
            $this->sendNotFound();
            return;
        }

        // Handle case like auth/check -> check
        $parts = explode('/', $action);
        $baseAction = $parts[0];
        
        // If first part is 'auth' and second part matches a registered route, use the second part
        if ($baseAction === 'auth' && count($parts) > 1 && array_key_exists($parts[1], $this->routes)) {
            $baseAction = $parts[1];
            // Remove 'auth/' from the action for the controller
            $action = substr($action, 5); 
        }

        if (array_key_exists($baseAction, $this->routes)) {
            $controllerClass = $this->routes[$baseAction];
            $controller = new $controllerClass();
            
            // If there's an ID in the path (e.g. revenues/123), put it in $_GET['id']
            if (count($parts) > 1 && !isset($_GET['id']) && $parts[1] !== $baseAction) {
                $_GET['id'] = $parts[1];
            }
            
            // Override action for controllers that switch on $_GET['action']
            $_GET['action'] = $baseAction;

            if (method_exists($controller, 'handle')) {
                $controller->handle();
            } else {
                $this->sendNotFound();
            }
        } else {
            $this->sendNotFound();
        }
    }

    private function sendNotFound() {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Endpoint not found']);
        exit;
    }
}
