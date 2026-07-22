<?php

namespace App\Policies\Concerns;

use App\Models\Store;
use App\Models\User;

trait AuthorizesStoreAccess
{
    protected function isAdmin(User $user): bool
    {
        return $user->role === 'admin' && $user->is_active;
    }

    protected function canAccessStore(User $user, Store|int $store): bool
    {
        if (! $user->is_active) {
            return false;
        }

        $storeId = $store instanceof Store ? $store->id : $store;

        if ($user->role === 'admin') {
            return true;
        }

        if ($user->role === 'merchant') {
            return $user->store()->whereKey($storeId)->exists();
        }

        if ($user->role === 'staff') {
            return (int) $user->store_id === (int) $storeId;
        }

        return false;
    }
}