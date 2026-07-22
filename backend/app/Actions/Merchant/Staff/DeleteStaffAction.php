<?php

namespace App\Actions\Merchant\Staff;

use App\Models\StoreStaff;

class DeleteStaffAction
{
    public function execute(StoreStaff $staff): void
    {
        $staff->user()->delete();
        $staff->delete();
    }
}