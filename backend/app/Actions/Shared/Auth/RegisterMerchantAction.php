<?php

namespace App\Actions\Shared\Auth;

use App\DTOs\Shared\Auth\RegisterMerchantData;
use App\Models\Plan;
use App\Models\Store;
use App\Models\User;
use App\Support\Tenant;

class RegisterMerchantAction
{
    public function execute(RegisterMerchantData $data): array
    {
        $attributes = $data->attributes;
        $plan = Plan::query()->where('slug', 'free')->first() ?? Plan::query()->firstOrFail();

        $user = User::query()->create([
            'name' => $attributes['name'],
            'email' => $attributes['email'],
            'phone' => $attributes['phone'] ?? null,
            'password' => $attributes['password'],
            'role' => 'merchant',
            'is_active' => true,
        ]);

        $store = Store::query()->create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'name' => $attributes['store_name'],
            'slug' => $attributes['store_slug'] ?? Tenant::slug($attributes['store_name'], 'stores'),
            'email' => $attributes['email'],
            'phone' => $attributes['phone'] ?? null,
        ]);

        return [
            'token' => $user->createToken('api')->plainTextToken,
            'user' => $user,
            'store' => $store,
        ];
    }
}