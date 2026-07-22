<?php

use App\Http\Controllers\Admin\AdminController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'role:admin'])->prefix('admin')->group(function () {
    Route::get('overview', [AdminController::class, 'overview']);
    Route::get('stores', [AdminController::class, 'stores']);
    Route::get('stores/{id}', [AdminController::class, 'showStore'])->whereNumber('id');
    Route::put('stores/{id}/status', [AdminController::class, 'updateStoreStatus']);
    Route::put('stores/{id}/plan', [AdminController::class, 'updateStorePlan']);
    Route::post('stores/{id}/extend', [AdminController::class, 'extendStore']);
    Route::get('users', [AdminController::class, 'users']);
    Route::put('users/{id}/status', [AdminController::class, 'updateUserStatus']);
    Route::get('plans', [AdminController::class, 'plans']);
    Route::post('plans', [AdminController::class, 'storePlan']);
    Route::put('plans/{id}', [AdminController::class, 'updatePlan']);
    Route::delete('plans/{id}', [AdminController::class, 'deletePlan']);
    Route::get('orders', [AdminController::class, 'orders']);
    Route::get('subscriptions', [AdminController::class, 'subscriptions']);
    Route::get('settings', [AdminController::class, 'settings']);
});

