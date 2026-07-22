<?php

namespace App\Providers;

use App\Models\Category;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Store;
use App\Models\StoreStaff;
use App\Models\User;
use App\Policies\CategoryPolicy;
use App\Policies\CouponPolicy;
use App\Policies\OrderPolicy;
use App\Policies\PlanPolicy;
use App\Policies\ProductPolicy;
use App\Policies\StorePolicy;
use App\Policies\StoreStaffPolicy;
use App\Policies\UserPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Gate::policy(Category::class, CategoryPolicy::class);
        Gate::policy(Coupon::class, CouponPolicy::class);
        Gate::policy(Order::class, OrderPolicy::class);
        Gate::policy(Plan::class, PlanPolicy::class);
        Gate::policy(Product::class, ProductPolicy::class);
        Gate::policy(Store::class, StorePolicy::class);
        Gate::policy(StoreStaff::class, StoreStaffPolicy::class);
        Gate::policy(User::class, UserPolicy::class);
    }
}