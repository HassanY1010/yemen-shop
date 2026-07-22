<?php

namespace App\Actions\Merchant\Product;

use App\Models\Product;

class SyncProductImagesAction
{
    public function execute(Product $product, int $storeId, array $images): void
    {
        $product->images()->delete();

        foreach (array_values(array_filter($images)) as $index => $url) {
            $product->images()->create([
                'store_id' => $storeId,
                'url' => $url,
                'is_primary' => $index === 0,
                'sort_order' => $index,
            ]);
        }
    }
}