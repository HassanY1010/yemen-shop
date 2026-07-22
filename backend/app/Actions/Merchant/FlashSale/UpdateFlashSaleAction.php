<?php

namespace App\Actions\Merchant\FlashSale;

use App\DTOs\Merchant\FlashSale\FlashSaleData;
use App\Models\FlashSale;

class UpdateFlashSaleAction
{
    public function execute(FlashSale $flashSale, FlashSaleData $data): FlashSale
    {
        $flashSale->update($data->attributes);

        return $flashSale->fresh('product.images');
    }
}