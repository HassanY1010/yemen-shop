<?php

namespace App\Actions\Merchant\Product;

use App\DTOs\Merchant\Product\ProductData;
use App\Models\Product;
use App\Models\Store;
use App\Support\Tenant;

class UpdateProductAction
{
    public function __construct(
        private readonly SyncProductImagesAction $syncProductImages,
    ) {}

    public function execute(Store $store, Product $product, ProductData $data): Product
    {
        $attributes = $data->attributes;

        if (array_key_exists('name', $attributes)) {
            $attributes['slug'] = Tenant::slug($attributes['name'], 'products', $store->id, $product->id);
        }

        $product->update($attributes);

        if (is_array($data->images)) {
            $this->syncProductImages->execute($product, $store->id, $data->images);
        }

        return $product->load('images', 'category');
    }
}