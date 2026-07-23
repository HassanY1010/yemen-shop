<?php

namespace App\Actions\Admin\Store;

use App\Models\Store;

class UpdateStoreStatusAction
{
    public function execute(Store $store, string $status): Store
    {
        $isActive = ($status === 'active' || $status === 'enabled') ? 1 : 0;
        $normalizedStatus = $isActive === 1 ? 'active' : 'suspended';

        $store->update([
            'status' => $normalizedStatus,
            'is_active' => $isActive,
        ]);

        return $store;
    }
}