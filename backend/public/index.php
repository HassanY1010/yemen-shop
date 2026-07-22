<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Serve storage files directly
if (isset($_SERVER['REQUEST_URI']) && str_starts_with($_SERVER['REQUEST_URI'], '/storage/')) {
    $relativePath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $filePath = __DIR__ . '/../storage/app/public' . str_replace('/storage', '', $relativePath);
    if (file_exists($filePath) && is_file($filePath)) {
        $mime = mime_content_type($filePath) ?: 'image/jpeg';
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . filesize($filePath));
        header('Access-Control-Allow-Origin: *');
        readfile($filePath);
        exit;
    }
}

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require __DIR__.'/../vendor/autoload.php';

// Bootstrap Laravel and handle the request...
/** @var Application $app */
$app = require_once __DIR__.'/../bootstrap/app.php';

$app->handleRequest(Request::capture());
