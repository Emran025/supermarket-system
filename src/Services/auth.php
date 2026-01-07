<?php
require_once __DIR__ . '/../config/db.php';

/**
 * Start session
 */
function start_session()
{
    if (session_status() === PHP_SESSION_NONE) {
        // Set a consistent session name to avoid path-based conflicts
        session_name('SUPERMARKET_SESSION');

        // Configure session cookie parameters BEFORE starting session
        // This is critical for proper cookie handling with encoded URLs
        session_set_cookie_params([
            'lifetime' => SESSION_LIFETIME,
            'path' => '/',
            'domain' => '',
            'secure' => false,  // Set to true if using HTTPS
            'httponly' => true,
            'samesite' => 'Lax'
        ]);

        // Start the session
        session_start();

        // Track session creation time
        if (!isset($_SESSION['created'])) {
            $_SESSION['created'] = time();
        }
        // Note: Session regeneration disabled to prevent redirect loops
        // The session token in the database must be updated if we regenerate the session ID

        // Log session info for debugging
        // Log session start (without exposing ID)
        // error_log("Session started: Name=" . session_name());
    }
}

/**
 * Check if user is logged in
 */
function is_logged_in()
{
    start_session();

    if (!isset($_SESSION['user_id']) || !isset($_SESSION['session_token'])) {
        error_log("Session check failed: user_id=" . (isset($_SESSION['user_id']) ? 'set' : 'missing') .
            ", session_token=" . (isset($_SESSION['session_token']) ? 'set' : 'missing') .
            ", session_id=" . session_id());
        return false;
    }

    $conn = get_db_connection();
    $user_id = $_SESSION['user_id'];
    $session_token = $_SESSION['session_token'];

    $stmt = mysqli_prepare($conn, "SELECT id FROM sessions WHERE user_id = ? AND session_token = ? AND expires_at > NOW()");
    mysqli_stmt_bind_param($stmt, "is", $user_id, $session_token);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);

    $is_valid = mysqli_num_rows($result) > 0;

    if (!$is_valid) {
        $check_stmt = mysqli_prepare($conn, "SELECT expires_at FROM sessions WHERE user_id = ? AND session_token = ?");
        mysqli_stmt_bind_param($check_stmt, "is", $user_id, $session_token);
        mysqli_stmt_execute($check_stmt);
        $check_res = mysqli_stmt_get_result($check_stmt);
        $session_data = mysqli_fetch_assoc($check_res);

        $db_now_q = mysqli_query($conn, "SELECT NOW() as now");
        $db_now = mysqli_fetch_assoc($db_now_q)['now'];

        if ($session_data) {
            error_log("Session validation failed for user_id=$user_id. Likely Expired. Expiry: " . $session_data['expires_at'] . ", DB Now: $db_now, PHP Now: " . date('Y-m-d H:i:s'));
        } else {
            error_log("Session validation failed for user_id=$user_id. Token mismatch or session deleted. Token: $session_token");
        }
        mysqli_stmt_close($check_stmt);
    }

    return $is_valid;
}

/**
 * Require login - redirect if not logged in
 */
function require_login()
{
    if (!is_logged_in()) {
        // Use relative path from the domain folder to presentation folder
        // This avoids issues with URL encoding of special characters in folder names
        $base_path = dirname($_SERVER['SCRIPT_NAME']);
        $login_path = dirname($base_path) . '/presentation/login.html';
        header('Location: ' . $login_path);
        exit;
    }
}

/**
 * Check login throttling
 */
function check_throttle($username)
{
    $conn = get_db_connection();

    $stmt = mysqli_prepare($conn, "SELECT attempts, locked_until FROM login_attempts WHERE username = ?");
    mysqli_stmt_bind_param($stmt, "s", $username);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);
    $row = mysqli_fetch_assoc($result);

    if ($row) {
        if ($row['locked_until'] && strtotime($row['locked_until']) > time()) {
            $wait_time = strtotime($row['locked_until']) - time();
            return [
                'locked' => true,
                'wait_time' => $wait_time
            ];
        }
    }

    return ['locked' => false];
}

/**
 * Record failed login attempt
 */
function record_failed_attempt($username)
{
    $conn = get_db_connection();

    $stmt = mysqli_prepare($conn, "SELECT attempts FROM login_attempts WHERE username = ?");
    mysqli_stmt_bind_param($stmt, "s", $username);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);
    $row = mysqli_fetch_assoc($result);

    if ($row) {
        $attempts = $row['attempts'] + 1;

        if ($attempts >= MAX_LOGIN_ATTEMPTS) {
            // Calculate lock time: base time * (attempts - max_attempts + 1)
            $lock_multiplier = $attempts - MAX_LOGIN_ATTEMPTS + 1;
            $lock_seconds = THROTTLE_BASE_TIME * $lock_multiplier;
            $locked_until = date('Y-m-d H:i:s', time() + $lock_seconds);

            $stmt = mysqli_prepare($conn, "UPDATE login_attempts SET attempts = ?, last_attempt = NOW(), locked_until = ? WHERE username = ?");
            mysqli_stmt_bind_param($stmt, "iss", $attempts, $locked_until, $username);
        } else {
            $stmt = mysqli_prepare($conn, "UPDATE login_attempts SET attempts = ?, last_attempt = NOW() WHERE username = ?");
            mysqli_stmt_bind_param($stmt, "is", $attempts, $username);
        }
    } else {
        $attempts = 1;
        $stmt = mysqli_prepare($conn, "INSERT INTO login_attempts (username, attempts, last_attempt) VALUES (?, ?, NOW())");
        mysqli_stmt_bind_param($stmt, "si", $username, $attempts);
    }

    mysqli_stmt_execute($stmt);
    mysqli_stmt_close($stmt);
}

/**
 * Clear failed attempts on successful login
 */
function clear_failed_attempts($username)
{
    $conn = get_db_connection();
    $stmt = mysqli_prepare($conn, "DELETE FROM login_attempts WHERE username = ?");
    mysqli_stmt_bind_param($stmt, "s", $username);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_close($stmt);
}

/**
 * Create session for user
 */
function create_session($user_id)
{
    $conn = get_db_connection();

    // Get user role for RBAC (now using role_id and joining roles table)
    $stmt = mysqli_prepare($conn, "
        SELECT u.role_id, r.role_key, r.role_name_ar 
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = ?
    ");
    mysqli_stmt_bind_param($stmt, "i", $user_id);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);
    $user = mysqli_fetch_assoc($result);
    mysqli_stmt_close($stmt);
    
    // Fallback to cashier if no role assigned
    if (!$user || !$user['role_id']) {
        // Get cashier role as default
        $default_stmt = mysqli_prepare($conn, "SELECT id, role_key FROM roles WHERE role_key = 'cashier' LIMIT 1");
        mysqli_stmt_execute($default_stmt);
        $default_result = mysqli_stmt_get_result($default_stmt);
        $default_role = mysqli_fetch_assoc($default_result);
        mysqli_stmt_close($default_stmt);
        
        $role_id = $default_role['id'] ?? 4; // Fallback to ID 4 (cashier)
        $role_key = $default_role['role_key'] ?? 'cashier';
    } else {
        $role_id = $user['role_id'];
        $role_key = $user['role_key'];
    }

    // Create new session
    $session_token = bin2hex(random_bytes(32));
    $expires_at = date('Y-m-d H:i:s', time() + SESSION_LIFETIME);
    $ip_address = $_SERVER['REMOTE_ADDR'] ?? '';
    // Truncate user agent if too long
    $user_agent = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255);

    $stmt = mysqli_prepare($conn, "INSERT INTO sessions (user_id, session_token, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)");
    mysqli_stmt_bind_param($stmt, "issss", $user_id, $session_token, $expires_at, $ip_address, $user_agent);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_close($stmt);

    start_session();
    session_regenerate_id(true); // Prevent session fixation
    $_SESSION['user_id'] = $user_id;
    $_SESSION['session_token'] = $session_token;
    $_SESSION['role_id'] = $role_id; // Store role ID
    $_SESSION['role_key'] = $role_key; // Store role key for backward compatibility

    // Load permissions into session for RBAC (using role_id)
    require_once __DIR__ . '/PermissionService.php';
    $_SESSION['permissions'] = PermissionService::loadPermissions($role_id);

    return $session_token;
}

/**
 * Destroy session
 */
function destroy_session()
{
    start_session();

    if (isset($_SESSION['user_id']) && isset($_SESSION['session_token'])) {
        $conn = get_db_connection();
        $session_token = $_SESSION['session_token'];

        $stmt = mysqli_prepare($conn, "DELETE FROM sessions WHERE session_token = ?");
        mysqli_stmt_bind_param($stmt, "s", $session_token);
        mysqli_stmt_execute($stmt);
        mysqli_stmt_close($stmt);
    }

    session_destroy();
}

/**
 * Login user
 */
function login($username, $password)
{
    $conn = get_db_connection();

    // Check throttling
    $throttle = check_throttle($username);
    if ($throttle['locked']) {
        return [
            'success' => false,
            'message' => 'Account locked. Please wait ' . ceil($throttle['wait_time'] / 60) . ' minutes before trying again.'
        ];
    }

    $stmt = mysqli_prepare($conn, "SELECT id, password FROM users WHERE username = ?");
    mysqli_stmt_bind_param($stmt, "s", $username);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);
    $user = mysqli_fetch_assoc($result);

    if ($user && password_verify($password, $user['password'])) {
        clear_failed_attempts($username);
        create_session($user['id']);
        return ['success' => true];
    } else {
        record_failed_attempt($username);
        return [
            'success' => false,
            'message' => 'Invalid username or password'
        ];
    }
}
