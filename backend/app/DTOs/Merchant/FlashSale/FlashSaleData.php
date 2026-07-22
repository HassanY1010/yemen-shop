<?php

namespace App\DTOs\Merchant\FlashSale;

final class FlashSaleData
{
    public function __construct(public readonly array $attributes) {}

    public static function fromArray(array $data): self
    {
        return new self($data);
    }
}