<?php

namespace App\Actions\Merchant\FlashSale;

use App\DTOs\Merchant\FlashSale\FlashSaleData;
use App\Models\FlashSale;
use App\Models\Store;

class CreateFlashSaleAction
{
    public function execute(Store $store, FlashSaleData $data): FlashSale
    {
        $attributes = $data->attributes;
        $attributes['store_id'] = $store->id;

        return FlashSale::query()->create($attributes)->load('product.images');
    }
}