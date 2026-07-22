<?php

namespace App\Actions\Customer\Order;

use App\DTOs\Customer\Order\CheckoutData;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Store;
use App\Support\Tenant;
use Illuminate\Support\Facades\DB;

class CreateOrderAction
{
    public function __construct(
        private readonly ResolveValidCouponAction $resolveValidCoupon,
    ) {}

    public function execute(Store $store, CheckoutData $data): Order
    {
        return DB::transaction(function () use ($store, $data) {
            $subtotal = 0;
            $items = [];

            foreach ($data->items as $line) {
                $product = Product::query()
                    ->where('store_id', $store->id)
                    ->where('status', 'active')
                    ->lockForUpdate()
                    ->findOrFail($line['product_id']);

                $quantity = (int) $line['quantity'];
                abort_if($product->manage_stock && $product->stock < $quantity, 422, "Insufficient stock for {$product->name}");

                $price = (float) ($product->sale_price ?? $product->price);

                if (! empty($line['variant_id'])) {
                    $variant = ProductVariant::query()
                        ->where('store_id', $store->id)
                        ->where('product_id', $product->id)
                        ->where('is_active', true)
                        ->findOrFail($line['variant_id']);
                    $price += (float) $variant->price_modifier;
                } elseif (! empty($line['variant_value'])) {
                    $variant = ProductVariant::query()
                        ->where('product_id', $product->id)
                        ->where('value', $line['variant_value'])
                        ->where('is_active', true)
                        ->first();
                    $price += (float) ($variant?->price_modifier ?? 0);
                }

                $total = $price * $quantity;
                $subtotal += $total;
                $items[] = compact('product', 'quantity', 'price', 'total');
            }

            $discount = 0;
            $coupon = null;

            if ($data->couponCode) {
                $coupon = $this->resolveValidCoupon->execute($store->id, $data->couponCode, $subtotal);
                $discount = $this->resolveValidCoupon->discount($coupon, $subtotal);
            }

            $customer = $this->resolveCustomer($store, $data->customer);

            $order = Order::query()->create([
                'store_id' => $store->id,
                'customer_id' => $customer?->id,
                'order_number' => Tenant::orderNumber(),
                'subtotal' => $subtotal,
                'discount' => $discount,
                'discount_amount' => $discount,
                'total' => $subtotal - $discount,
                'currency' => $store->currency,
                'customer_name' => $data->customer['name'],
                'customer_email' => $data->customer['email'] ?? null,
                'customer_phone' => $data->customer['phone'] ?? null,
                'shipping_address' => $data->shippingAddress,
                'shipping_city' => $data->shippingCity,
                'payment_method' => $data->paymentMethod,
                'notes' => $data->notes,
            ]);

            foreach ($items as $line) {
                $order->items()->create([
                    'store_id' => $store->id,
                    'product_id' => $line['product']->id,
                    'product_name' => $line['product']->name,
                    'product_sku' => $line['product']->sku,
                    'price' => $line['price'],
                    'quantity' => $line['quantity'],
                    'total' => $line['total'],
                ]);

                $line['product']->decrement('stock', $line['quantity']);
                $line['product']->increment('total_sold', $line['quantity']);
            }

            $coupon?->increment('used_count');
            $store->increment('total_sales', $order->total);
            $customer?->increment('total_orders');
            $customer?->increment('total_spent', $order->total);

            return $order->load('items');
        });
    }

    private function resolveCustomer(Store $store, array $customerData): ?Customer
    {
        if (empty($customerData['email'])) {
            return null;
        }

        return Customer::query()->firstOrCreate(
            ['store_id' => $store->id, 'email' => $customerData['email']],
            ['name' => $customerData['name'], 'phone' => $customerData['phone'] ?? null],
        );
    }
}