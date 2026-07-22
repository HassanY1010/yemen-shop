<?php

namespace Database\Factories;

use App\Models\Plan;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class StoreFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->company();
        return [
            'user_id' => User::factory(),
            'plan_id' => Plan::factory(),
            'name' => $name,
            'slug' => Str::slug($name).'-'.fake()->unique()->numberBetween(100, 999),
            'currency' => 'YER',
            'status' => 'active',
        ];
    }
}
