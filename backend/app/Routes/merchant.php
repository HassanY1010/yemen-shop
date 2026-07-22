<?php

use App\Http\Controllers\Merchant\MerchantController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'role:merchant,staff'])->prefix('dashboard')->group(function () {
    Route::get('overview', [MerchantController::class, 'overview']);
    Route::get('plans', [MerchantController::class, 'plans']);
    Route::post('upload', [MerchantController::class, 'upload']);
    Route::post('subscribe', [MerchantController::class, 'subscribe']);
    Route::get('flash-sales', [MerchantController::class, 'flashSales']);
    Route::post('flash-sales', [MerchantController::class, 'storeFlashSale']);
    Route::put('flash-sales/{id}', [MerchantController::class, 'updateFlashSale']);
    Route::delete('flash-sales/{id}', [MerchantController::class, 'deleteFlashSale']);
    Route::get('products/stock-alerts', [MerchantController::class, 'stockAlerts']);
    Route::get('products', [MerchantController::class, 'products']);
    Route::post('products', [MerchantController::class, 'storeProduct']);
    Route::get('products/{id}', [MerchantController::class, 'showProduct']);
    Route::put('products/{id}', [MerchantController::class, 'updateProduct']);
    Route::delete('products/{id}', [MerchantController::class, 'deleteProduct']);
    Route::get('products/{id}/variants', [MerchantController::class, 'productVariants']);
    Route::post('products/{id}/variants', [MerchantController::class, 'syncProductVariants']);
    Route::get('categories', [MerchantController::class, 'categories']);
    Route::post('categories', [MerchantController::class, 'storeCategory']);
    Route::put('categories/{id}', [MerchantController::class, 'updateCategory']);
    Route::delete('categories/{id}', [MerchantController::class, 'deleteCategory']);
    Route::get('orders/export', [MerchantController::class, 'exportOrders']);
    Route::get('orders', [MerchantController::class, 'orders']);
    Route::get('orders/{id}', [MerchantController::class, 'showOrder'])->whereNumber('id');
    Route::put('orders/{id}/status', [MerchantController::class, 'updateOrderStatus']);
    Route::get('customers', [MerchantController::class, 'customers']);
    Route::get('coupons', [MerchantController::class, 'coupons']);
    Route::post('coupons', [MerchantController::class, 'storeCoupon']);
    Route::post('coupons/validate', [MerchantController::class, 'validateCoupon']);
    Route::put('coupons/{id}', [MerchantController::class, 'updateCoupon']);
    Route::delete('coupons/{id}', [MerchantController::class, 'deleteCoupon']);
    Route::get('staff', [MerchantController::class, 'staff']);
    Route::post('staff', [MerchantController::class, 'storeStaff']);
    Route::put('staff/{id}', [MerchantController::class, 'updateStaff']);
    Route::delete('staff/{id}', [MerchantController::class, 'deleteStaff']);
    Route::get('analytics', [MerchantController::class, 'analytics']);
    Route::get('notifications', [MerchantController::class, 'notifications']);
    Route::post('notifications/read-all', [MerchantController::class, 'readAllNotifications']);
    Route::get('profile', [MerchantController::class, 'profile']);
    Route::put('profile', [MerchantController::class, 'updateProfile']);
    Route::put('password', [MerchantController::class, 'updatePassword']);
    Route::get('store', [MerchantController::class, 'storeSettings']);
    Route::put('store', [MerchantController::class, 'updateStoreSettings']);
});


