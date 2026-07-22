<?php

namespace App\Actions\Customer\Auth;

use App\Models\Customer;
use App\Models\Store;
use Illuminate\Http\Request;

class ResolveCustomerFromTokenAction
{
    public function execute(Request $request, Store $store): Customer
    {
        $token = $request->bearerToken() ?: $request->query('token');
        abort_if(! $token, 401, 'Customer token required.');

        $decoded = base64_decode($token, true);
        abort_if(! $decoded, 401, 'Invalid customer token.');

        [$storeId, $customerId] = array_pad(explode('|', $decoded), 2, null);
        abort_if((int) $storeId !== (int) $store->id || ! $customerId, 401, 'Invalid customer token.');

        return $store->customers()->findOrFail((int) $customerId);
    }
}