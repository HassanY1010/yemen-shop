<?php

namespace App\DTOs\Merchant\Category;

final class CategoryData
{
    public function __construct(public readonly array $attributes) {}

    public static function fromArray(array $data): self
    {
        return new self($data);
    }
}