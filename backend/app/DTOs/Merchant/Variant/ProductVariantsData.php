<?php

namespace App\DTOs\Merchant\Variant;

final class ProductVariantsData
{
    public function __construct(public readonly array $variants) {}

    public static function fromArray(array $data): self
    {
        return new self($data['variants']);
    }
}