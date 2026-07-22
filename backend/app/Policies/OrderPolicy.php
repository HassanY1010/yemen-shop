<?php

namespace App\Policies;

use App\Models\Order;
use App\Models\User;
use App\Policies\Concerns\AuthorizesStoreAccess;

class OrderPolicy
{
    use AuthorizesStoreAccess;

    public function view(User $user, Order $order): bool { return $this->canAccessStore($user, $order->store_id); }
    public function update(User $user, Order $order): bool { return $this->canAccessStore($user, $order->store_id); }
}