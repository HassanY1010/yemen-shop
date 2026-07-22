<?php

namespace App\Policies;

use App\Models\Plan;
use App\Models\User;

class PlanPolicy
{
    public function viewAny(User $user): bool { return $user->role === 'admin' && $user->is_active; }
    public function create(User $user): bool { return $user->role === 'admin' && $user->is_active; }
    public function update(User $user, Plan $plan): bool { return $user->role === 'admin' && $user->is_active; }
    public function delete(User $user, Plan $plan): bool { return $user->role === 'admin' && $user->is_active; }
}