<?php

namespace App\Actions\Merchant\Store;

use App\DTOs\Merchant\Store\StoreSettingsData;
use App\Models\Store;

class UpdateStoreSettingsAction
{
    public function execute(Store $store, StoreSettingsData $data): Store
    {
        $store->update($data->attributes);

        return $store;
    }
}