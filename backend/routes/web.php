<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/storage/{path}', function ($path) {
    $fullPath = storage_path('app/public/' . $path);
    if (!file_exists($fullPath)) {
        abort(404);
    }
    $mime = mime_content_type($fullPath) ?: 'image/jpeg';
    return response()->file($fullPath, ['Content-Type' => $mime]);
})->where('path', '.*');
