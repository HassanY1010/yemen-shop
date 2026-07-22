<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SaasArchitectureTest extends TestCase
{
    use RefreshDatabase;

    public function test_merchant_can_create_product_with_images(): void
    {
        [$merchant, $store] = $this->merchantWithStore();
        Sanctum::actingAs($merchant);

        $response = $this->postJson('/api/dashboard/products', [
            'name' => 'Premium Honey',
            'price' => 120,
            'stock' => 8,
            'status' => 'active',
            'images' => ['https://example.com/honey-1.jpg', 'https://example.com/honey-2.jpg'],
        ]);

        $response->assertCreated()
            ->assertJsonPath('product.store_id', $store->id)
            ->assertJsonPath('product.name', 'Premium Honey');

        $this->assertDatabaseHas('products', ['store_id' => $store->id, 'name' => 'Premium Honey']);
        $this->assertDatabaseCount('product_images', 2);
    }

    public function test_merchant_cannot_update_product_from_another_store(): void
    {
        [$merchant] = $this->merchantWithStore();
        [, $otherStore] = $this->merchantWithStore();
        $product = Product::query()->create([
            'store_id' => $otherStore->id,
            'name' => 'Other Store Product',
            'slug' => 'other-store-product',
            'price' => 50,
            'stock' => 3,
            'status' => 'active',
        ]);

        Sanctum::actingAs($merchant);

        $this->putJson("/api/dashboard/products/{$product->id}", [
            'name' => 'Changed Name',
            'price' => 60,
        ])->assertNotFound();
    }

    public function test_customer_checkout_creates_order_and_updates_stock(): void
    {
        [, $store] = $this->merchantWithStore();
        $product = Product::query()->create([
            'store_id' => $store->id,
            'name' => 'Coffee Beans',
            'slug' => 'coffee-beans',
            'price' => 25,
            'stock' => 10,
            'status' => 'active',
            'manage_stock' => true,
        ]);

        $response = $this->postJson("/api/store/{$store->slug}/orders", [
            'customer_name' => 'Sara Customer',
            'customer_email' => 'sara@example.com',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('order.customer_name', 'Sara Customer')
            ->assertJsonPath('order.total', '50.00');

        $this->assertDatabaseHas('orders', ['store_id' => $store->id, 'customer_email' => 'sara@example.com']);
        $this->assertSame(8, $product->fresh()->stock);
        $this->assertSame(1, Order::query()->count());
    }

    public function test_admin_routes_reject_non_admin_users(): void
    {
        [$merchant, $store] = $this->merchantWithStore();
        Sanctum::actingAs($merchant);

        $this->putJson("/api/admin/stores/{$store->id}/status", ['status' => 'suspended'])
            ->assertForbidden();
    }

    public function test_admin_can_update_store_status(): void
    {
        [, $store] = $this->merchantWithStore();
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->putJson("/api/admin/stores/{$store->id}/status", ['status' => 'suspended'])
            ->assertOk()
            ->assertJsonPath('status', 'suspended');

        $this->assertDatabaseHas('stores', ['id' => $store->id, 'status' => 'suspended']);
    }

    private function merchantWithStore(): array
    {
        $plan = Plan::factory()->create(['slug' => fake()->unique()->slug()]);
        $merchant = User::factory()->create(['role' => 'merchant', 'is_active' => true]);
        $store = Store::factory()->create([
            'user_id' => $merchant->id,
            'plan_id' => $plan->id,
            'status' => 'active',
        ]);

        return [$merchant, $store];
    }
}