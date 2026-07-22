<?php

namespace App\Actions\Merchant\Staff;

use App\DTOs\Merchant\Staff\StaffData;
use App\Models\StoreStaff;

class UpdateStaffAction
{
    public function execute(StoreStaff $staff, StaffData $data): StoreStaff
    {
        $attributes = $data->attributes;

        $staff->update(array_intersect_key($attributes, array_flip(['is_active', 'permissions'])));
        $staff->user->update(array_intersect_key($attributes, array_flip(['name', 'phone', 'is_active'])));

        return $staff->load('user');
    }
}