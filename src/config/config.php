<?php
// Set timezone to match local time (+03:00)
date_default_timezone_set('Asia/Riyadh');
// Database configuration
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'supermarket_system');

// Session configuration
define('SESSION_LIFETIME', 3600); // 1 hour
define('MAX_LOGIN_ATTEMPTS', 3);
define('THROTTLE_BASE_TIME', 60); // 1 minute base wait time

// Application paths
define('BASE_PATH', dirname(__DIR__));
define('DOMAIN_PATH', BASE_PATH . '/domain');
define('PRESENTATION_PATH', BASE_PATH . '/presentation');
