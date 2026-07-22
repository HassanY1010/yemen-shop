<?php

namespace App\DTOs\Merchant\Store;

final class StoreSettingsData
{
    public function __construct(public readonly array $attributes) {}

    public static function fromArray(array $data): self
    {
        return new self($data);
    }
}