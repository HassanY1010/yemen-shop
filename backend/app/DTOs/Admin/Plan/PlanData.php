<?php

namespace App\DTOs\Admin\Plan;

final class PlanData
{
    public function __construct(public readonly array $attributes) {}

    public static function fromArray(array $data): self
    {
        return new self($data);
    }
}