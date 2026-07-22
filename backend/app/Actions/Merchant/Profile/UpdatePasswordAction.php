<?php

namespace App\Actions\Merchant\Profile;

use App\Models\User;
use Illuminate\Support\Facades\Hash;

class UpdatePasswordAction
{
    public function execute(User $user, string $currentPassword, string $newPassword): void
    {
        abort_unless(Hash::check($currentPassword, $user->password), 422, 'Current password is invalid.');

        $user->update(['password' => $newPassword]);
    }
}