<?php

namespace App\Actions\Shared\Auth;

use App\Models\User;
use App\Support\Tenant;
use Illuminate\Support\Facades\Hash;

class LoginUserAction
{
    public function execute(string $email, string $password): array
    {
        $user = User::query()->where('email', $email)->first();

        if (! $user || ! Hash::check($password, $user->password) || ! $user->is_active) {
            abort(422, 'Invalid credentials');
        }

        return [
            'token' => $user->createToken('api')->plainTextToken,
            'user' => $user->load('store.plan'),
            'store' => Tenant::storeFor($user),
        ];
    }
}