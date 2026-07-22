<?php

namespace App\Policies;

use App\Models\Coupon;
use App\Models\User;
use App\Policies\Concerns\AuthorizesStoreAccess;

class CouponPolicy
{
    use AuthorizesStoreAccess;

    public function create(User $user, int $storeId): bool { return $this->canAccessStore($user, $storeId); }
    public function update(User $user, Coupon $coupon): bool { return $this->canAccessStore($user, $coupon->store_id); }
    public function delete(User $user, Coupon $coupon): bool { return $this->canAccessStore($user, $coupon->store_id); }
}