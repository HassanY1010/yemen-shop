<?php

namespace App\DTOs\Shared\Auth;

final class RegisterMerchantData
{
    public function __construct(public readonly array $attributes) {}

    public static function fromArray(array $data): self
    {
        return new self($data);
    }
}