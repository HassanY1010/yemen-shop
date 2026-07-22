<?php

namespace App\Actions\Merchant\Product;

use App\DTOs\Merchant\Product\ProductData;
use App\Models\Product;
use App\Models\Store;
use App\Support\Tenant;

class CreateProductAction
{
    public function __construct(
        private readonly SyncProductImagesAction $syncProductImages,
    ) {}

    public function execute(Store $store, ProductData $data): Product
    {
        $attributes = $data->attributes;
        $attributes['store_id'] = $store->id;
        $attributes['slug'] = Tenant::slug($attributes['name'], 'products', $store->id);

        $product = Product::query()->create($attributes);
        $this->syncProductImages->execute($product, $store->id, $data->images ?? []);

        return $product->load('images', 'category');
    }
}