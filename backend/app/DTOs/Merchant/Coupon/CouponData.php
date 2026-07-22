<?php

namespace App\DTOs\Merchant\Coupon;

final class CouponData
{
    public function __construct(
        public readonly array $attributes,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self($data);
    }
}