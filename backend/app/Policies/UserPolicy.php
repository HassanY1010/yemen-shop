<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function update(User $actor, User $target): bool
    {
        return $actor->role === 'admin' && $actor->is_active;
    }
}