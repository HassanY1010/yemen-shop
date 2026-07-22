<?php

namespace App\Actions\Admin\Store;

use App\Models\Store;

class UpdateStoreStatusAction
{
    public function execute(Store $store, string $status): Store
    {
        $store->update(['status' => $status]);

        return $store;
    }
}