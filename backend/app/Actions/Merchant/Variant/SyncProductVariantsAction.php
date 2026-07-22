<?php

namespace App\Actions\Merchant\Variant;

use App\DTOs\Merchant\Variant\ProductVariantsData;
use App\Models\ProductVariant;
use App\Models\Store;

class SyncProductVariantsAction
{
    public function execute(Store $store, int $productId, ProductVariantsData $data): array
    {
        ProductVariant::query()
            ->where('store_id', $store->id)
            ->where('product_id', $productId)
            ->delete();

        foreach (array_values($data->variants) as $index => $variant) {
            ProductVariant::query()->create([
                'store_id' => $store->id,
                'product_id' => $productId,
                'type' => $variant['type'],
                'value' => $variant['value'],
                'price_modifier' => $variant['price_modifier'] ?? 0,
                'stock' => $variant['stock'] ?? 0,
                'sku' => $variant['sku'] ?? null,
                'sort_order' => $index,
                'is_active' => $variant['is_active'] ?? true,
            ]);
        }

        return ProductVariant::query()
            ->where('store_id', $store->id)
            ->where('product_id', $productId)
            ->orderBy('sort_order')
            ->get()
            ->all();
    }
}