<?php

namespace App\Actions\Customer\Profile;

use App\Models\Customer;

class UpdateCustomerProfileAction
{
    public function execute(Customer $customer, array $attributes): Customer
    {
        $customer->update($attributes);

        return $customer->fresh();
    }
}