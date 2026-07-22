<?php

namespace App\Actions\Merchant\Staff;

use App\DTOs\Merchant\Staff\StaffData;
use App\Models\Store;
use App\Models\StoreStaff;
use App\Models\User;

class CreateStaffAction
{
    public function execute(Store $store, StaffData $data): StoreStaff
    {
        $attributes = $data->attributes;

        $user = User::query()->create([
            'store_id' => $store->id,
            'name' => $attributes['name'],
            'email' => $attributes['email'],
            'phone' => $attributes['phone'] ?? null,
            'password' => $attributes['password'],
            'role' => 'staff',
        ]);

        return StoreStaff::query()
            ->create([
                'store_id' => $store->id,
                'user_id' => $user->id,
                'permissions' => $attributes['permissions'] ?? [],
            ])
            ->load('user');
    }
}