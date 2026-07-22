<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Coupon;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Plan;
use App\Models\Product;
use App\Models\FlashSale;
use App\Models\ProductReview;
use App\Models\ProductVariant;
use App\Models\Store;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            ['name' => 'Free', 'slug' => 'free', 'price' => 0, 'max_products' => 10, 'max_images' => 3, 'max_staff' => 1, 'max_orders' => 50, 'features' => ['basic_store', 'product_management', 'order_management']],
            ['name' => 'Basic', 'slug' => 'basic', 'price' => 49, 'max_products' => 50, 'max_images' => 5, 'max_staff' => 2, 'max_orders' => 500, 'features' => ['customer_management', 'analytics_basic', 'custom_domain']],
            ['name' => 'Pro', 'slug' => 'pro', 'price' => 99, 'max_products' => 200, 'max_images' => 10, 'max_staff' => 5, 'max_orders' => 2000, 'features' => ['advanced_analytics', 'discount_coupons', 'priority_support']],
            ['name' => 'Business', 'slug' => 'business', 'price' => 199, 'max_products' => -1, 'max_images' => -1, 'max_staff' => -1, 'max_orders' => -1, 'features' => ['unlimited_products', 'api_access', 'white_label']],
        ];

        foreach ($plans as $plan) {
            Plan::query()->updateOrCreate(['slug' => $plan['slug']], $plan + ['billing_cycle' => 'monthly', 'is_active' => true]);
        }

        $admin = User::query()->updateOrCreate(
            ['email' => 'admin@platform.com'],
            ['name' => 'Platform Admin', 'password' => 'password', 'role' => 'admin', 'is_active' => true]
        );

        $merchant = User::query()->updateOrCreate(
            ['email' => 'merchant@demo.com'],
            ['name' => 'Demo Merchant', 'password' => 'password', 'role' => 'merchant', 'phone' => '0500000000', 'is_active' => true]
        );

        $store = Store::query()->updateOrCreate(
            ['slug' => 'demo'],
            [
                'user_id' => $merchant->id,
                'plan_id' => Plan::where('slug', 'pro')->value('id'),
                'name' => 'Demo Store',
                'description' => 'Demo SaaS storefront connected to Laravel API.',
                'primary_color' => '#4F46E5',
                'secondary_color' => '#10B981',
                'currency' => 'YER',
                'email' => 'merchant@demo.com',
                'phone' => '0500000000',
                'city' => 'Riyadh',
                'country' => 'SA',
                'status' => 'active',
                'subscription_status' => 'active',
                'subscription_ends_at' => now()->addMonth(),
            ]
        );

        Subscription::query()->updateOrCreate(
            ['store_id' => $store->id, 'plan_id' => $store->plan_id],
            ['status' => 'active', 'amount' => 99, 'ends_at' => now()->addMonth()]
        );

        $categories = collect([
            ['name' => 'Phones', 'slug' => 'phones', 'sort_order' => 1],
            ['name' => 'Computers', 'slug' => 'computers', 'sort_order' => 2],
            ['name' => 'Accessories', 'slug' => 'accessories', 'sort_order' => 3],
        ])->mapWithKeys(fn ($cat) => [$cat['slug'] => Category::query()->updateOrCreate(['store_id' => $store->id, 'slug' => $cat['slug']], $cat + ['store_id' => $store->id, 'is_active' => true])]);

        $products = [
            ['category' => 'phones', 'name' => 'iPhone 15 Pro', 'slug' => 'iphone-15-pro', 'price' => 4999, 'sale_price' => 4599, 'stock' => 25, 'featured' => true, 'image' => 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600'],
            ['category' => 'phones', 'name' => 'Samsung Galaxy S24', 'slug' => 'samsung-s24', 'price' => 3999, 'sale_price' => null, 'stock' => 30, 'featured' => true, 'image' => 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600'],
            ['category' => 'computers', 'name' => 'MacBook Pro 14', 'slug' => 'macbook-pro-14', 'price' => 8999, 'sale_price' => 8499, 'stock' => 10, 'featured' => true, 'image' => 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600'],
            ['category' => 'accessories', 'name' => 'AirPods Pro', 'slug' => 'airpods-pro', 'price' => 999, 'sale_price' => 849, 'stock' => 50, 'featured' => false, 'image' => 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=600'],
            ['category' => 'accessories', 'name' => 'MagSafe Charger', 'slug' => 'magsafe-charger', 'price' => 249, 'sale_price' => null, 'stock' => 100, 'featured' => false, 'image' => 'https://images.unsplash.com/photo-1592753563062-83e0a9e77b31?w=600'],
        ];

        foreach ($products as $item) {
            $product = Product::query()->updateOrCreate(
                ['store_id' => $store->id, 'slug' => $item['slug']],
                [
                    'category_id' => $categories[$item['category']]->id,
                    'name' => $item['name'],
                    'description' => $item['name'].' demo product description.',
                    'short_description' => 'High quality demo product.',
                    'sku' => strtoupper(str_replace('-', '-', $item['slug'])),
                    'price' => $item['price'],
                    'sale_price' => $item['sale_price'],
                    'stock' => $item['stock'],
                    'status' => 'active',
                    'featured' => $item['featured'],
                ]
            );
            $product->images()->updateOrCreate(['url' => $item['image']], ['store_id' => $store->id, 'is_primary' => true, 'sort_order' => 0]);
        }

        foreach ([
            ['code' => 'SUMMER20', 'type' => 'percentage', 'value' => 20, 'min_order_amount' => 100],
            ['code' => 'WELCOME50', 'type' => 'fixed', 'value' => 50, 'min_order_amount' => 150],
            ['code' => 'VIP30', 'type' => 'percentage', 'value' => 30, 'min_order_amount' => 500],
        ] as $coupon) {
            Coupon::query()->updateOrCreate(['store_id' => $store->id, 'code' => $coupon['code']], $coupon + ['store_id' => $store->id, 'is_active' => true]);
        }

        $customer = Customer::query()->updateOrCreate(
            ['store_id' => $store->id, 'email' => 'customer@demo.com'],
            ['name' => 'Demo Customer', 'phone' => '0550000000', 'city' => 'Riyadh', 'password' => 'password']
        );

        $order = Order::query()->firstOrCreate(
            ['order_number' => 'ORD-DEMO-001'],
            ['store_id' => $store->id, 'customer_id' => $customer->id, 'status' => 'processing', 'payment_status' => 'paid', 'subtotal' => 4599, 'total' => 4599, 'currency' => 'YER', 'customer_name' => $customer->name, 'customer_email' => $customer->email, 'customer_phone' => $customer->phone, 'shipping_city' => 'Riyadh']
        );
        $product = Product::where('store_id', $store->id)->where('slug', 'iphone-15-pro')->first();
        $order->items()->firstOrCreate(['product_id' => $product->id], ['store_id' => $store->id, 'product_name' => $product->name, 'product_sku' => $product->sku, 'price' => 4599, 'quantity' => 1, 'total' => 4599]);

        $iphone = Product::where('store_id', $store->id)->where('slug', 'iphone-15-pro')->first();
        if ($iphone) {
            foreach ([
                ['type' => 'color', 'value' => 'Natural Titanium', 'price_modifier' => 0, 'stock' => 8, 'sku' => 'IPHONE-15-PRO-NT'],
                ['type' => 'color', 'value' => 'Blue Titanium', 'price_modifier' => 0, 'stock' => 7, 'sku' => 'IPHONE-15-PRO-BT'],
                ['type' => 'storage', 'value' => '512GB', 'price_modifier' => 700, 'stock' => 5, 'sku' => 'IPHONE-15-PRO-512'],
            ] as $index => $variant) {
                ProductVariant::query()->updateOrCreate(
                    ['store_id' => $store->id, 'product_id' => $iphone->id, 'type' => $variant['type'], 'value' => $variant['value']],
                    $variant + ['sort_order' => $index, 'is_active' => true]
                );
            }

            FlashSale::query()->updateOrCreate(
                ['store_id' => $store->id, 'product_id' => $iphone->id, 'title' => 'Demo Flash Sale'],
                ['discount_type' => 'percentage', 'discount_value' => 15, 'start_at' => now()->subDay(), 'end_at' => now()->addWeek(), 'max_quantity' => 20, 'sold_quantity' => 0, 'is_active' => true]
            );

            ProductReview::query()->updateOrCreate(
                ['store_id' => $store->id, 'product_id' => $iphone->id, 'customer_name' => 'Demo Customer'],
                ['customer_id' => $customer->id, 'rating' => 5, 'comment' => 'Excellent demo product.']
            );
        }
        $store->update(['total_sales' => Order::where('store_id', $store->id)->sum('total')]);
    }
}

