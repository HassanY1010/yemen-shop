<?php

namespace App\DTOs\Customer\Order;

final class CheckoutData
{
    public function __construct(
        public readonly array $customer,
        public readonly array $items,
        public readonly ?string $shippingAddress = null,
        public readonly ?string $shippingCity = null,
        public readonly ?string $paymentMethod = null,
        public readonly ?string $couponCode = null,
        public readonly ?string $notes = null,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            customer: $data['customer'],
            items: $data['items'],
            shippingAddress: $data['shipping_address'] ?? null,
            shippingCity: $data['shipping_city'] ?? null,
            paymentMethod: $data['payment_method'] ?? null,
            couponCode: $data['coupon_code'] ?? null,
            notes: $data['notes'] ?? null,
        );
    }
}