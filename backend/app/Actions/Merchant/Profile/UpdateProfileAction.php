<?php

namespace App\Actions\Merchant\Profile;

use App\Models\User;

class UpdateProfileAction
{
    public function execute(User $user, array $attributes): User
    {
        $user->update($attributes);

        return $user;
    }
}