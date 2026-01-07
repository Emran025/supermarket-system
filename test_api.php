<?php
// Quick test to simulate API call to 'login'
$_GET['action'] = 'login';
// Make sure server vars expected by api.php are set
$_SERVER['REQUEST_METHOD'] = 'POST';
require __DIR__ . '/public/index.php';
