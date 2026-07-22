<?php

namespace App\DTOs\Merchant\Staff;

final class StaffData
{
    public function __construct(public readonly array $attributes) {}

    public static function fromArray(array $data): self
    {
        return new self($data);
    }
}