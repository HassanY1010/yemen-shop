<?php

namespace App\Policies;

use App\Models\StoreStaff;
use App\Models\User;
use App\Policies\Concerns\AuthorizesStoreAccess;

class StoreStaffPolicy
{
    use AuthorizesStoreAccess;

    public function create(User $user, int $storeId): bool { return $this->canAccessStore($user, $storeId); }
    public function update(User $user, StoreStaff $staff): bool { return $this->canAccessStore($user, $staff->store_id); }
    public function delete(User $user, StoreStaff $staff): bool { return $this->canAccessStore($user, $staff->store_id); }
}