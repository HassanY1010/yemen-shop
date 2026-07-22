<?php

namespace App\Actions\Customer\Auth;

use App\Models\Customer;
use App\Models\Store;

class CustomerToken
{
    public function make(Store $store, Customer $customer): string
    {
        return base64_encode($store->id.'|'.$customer->id.'|'.now());
    }
}