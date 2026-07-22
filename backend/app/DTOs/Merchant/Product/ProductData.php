<?php

namespace App\DTOs\Merchant\Product;

final class ProductData
{
    public function __construct(
        public readonly array $attributes,
        public readonly ?array $images = null,
    ) {}

    public static function fromArray(array $data, ?array $defaultImages = null): self
    {
        $images = array_key_exists('images', $data) ? $data['images'] : $defaultImages;
        unset($data['images']);

        return new self($data, $images);
    }
}