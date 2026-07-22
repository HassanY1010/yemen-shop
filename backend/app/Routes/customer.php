<?php

use App\Http\Controllers\Customer\CustomerStoreController;
use Illuminate\Support\Facades\Route;

Route::prefix('store/{slug}')->group(function () {
    Route::get('/', [CustomerStoreController::class, 'show']);
    Route::get('products', [CustomerStoreController::class, 'products']);
    Route::get('products/{productSlug}', [CustomerStoreController::class, 'product']);
    Route::get('categories', [CustomerStoreController::class, 'categories']);
    Route::post('orders', [CustomerStoreController::class, 'createOrder']);
    Route::post('coupons/validate', [CustomerStoreController::class, 'validateCoupon']);
    Route::post('customers/register', [CustomerStoreController::class, 'registerCustomer']);
    Route::post('customers/login', [CustomerStoreController::class, 'loginCustomer']);
    Route::get('customers/me', [CustomerStoreController::class, 'customerMe']);
    Route::get('customers/orders', [CustomerStoreController::class, 'customerOrders']);
    Route::put('customers/profile', [CustomerStoreController::class, 'updateCustomerProfile']);
    Route::get('track-order', [CustomerStoreController::class, 'trackOrder']);
    Route::get('orders/track', [CustomerStoreController::class, 'trackOrder']);
    Route::post('products/{id}/reviews', [CustomerStoreController::class, 'createReview']);
});

Route::get('public/flash-sale/{productId}', [CustomerStoreController::class, 'publicFlashSale']);
Route::get('public/products/{productId}/variants', [CustomerStoreController::class, 'publicVariants']);

