<?php

namespace App\Actions\Customer\Auth;

use App\Models\Store;

class RegisterCustomerAction
{
    public function __construct(private readonly CustomerToken $customerToken) {}

    public function execute(Store $store, array $attributes): array
    {
        $customer = $store->customers()->create($attributes);

        return [
            'customer' => $customer,
            'token' => $this->customerToken->make($store, $customer),
        ];
    }
}