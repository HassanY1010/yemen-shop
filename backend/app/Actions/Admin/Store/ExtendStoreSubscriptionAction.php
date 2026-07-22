<?php

namespace App\Actions\Admin\Store;

use App\Models\Store;

class ExtendStoreSubscriptionAction
{
    public function execute(Store $store): Store
    {
        $store->update([
            'subscription_status' => 'active',
            'subscription_ends_at' => now()->addMonth(),
        ]);

        return $store;
    }
}