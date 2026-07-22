<?php

namespace App\Policies;

use App\Models\Store;
use App\Models\User;
use App\Policies\Concerns\AuthorizesStoreAccess;

class StorePolicy
{
    use AuthorizesStoreAccess;

    public function viewAny(User $user): bool { return $this->isAdmin($user); }
    public function view(User $user, Store $store): bool { return $this->canAccessStore($user, $store); }
    public function update(User $user, Store $store): bool { return $this->canAccessStore($user, $store); }
    public function managePlatform(User $user, Store $store): bool { return $this->isAdmin($user); }
}