<?php

namespace App\Actions\Customer\Auth;

use App\Models\Store;
use Illuminate\Support\Facades\Hash;

class LoginCustomerAction
{
    public function __construct(private readonly CustomerToken $customerToken) {}

    public function execute(Store $store, string $login, string $password): array
    {
        $normalizedLogin = mb_strtolower(trim($login));
        $customer = $store->customers()
            ->where(fn ($query) => $query->where('email', $normalizedLogin)->orWhere('phone', $login))
            ->first();

        if (! $customer || ! $customer->password || ! Hash::check($password, $customer->password)) {
            abort(422, 'Invalid credentials');
        }

        return [
            'customer' => $customer,
            'token' => $this->customerToken->make($store, $customer),
        ];
    }
}