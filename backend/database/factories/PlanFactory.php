<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class PlanFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->word();
        return ['name' => ucfirst($name), 'slug' => Str::slug($name).'-'.fake()->unique()->numberBetween(1, 9999), 'price' => fake()->numberBetween(0, 200), 'features' => []];
    }
}
