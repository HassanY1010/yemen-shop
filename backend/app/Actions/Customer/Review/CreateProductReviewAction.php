<?php

namespace App\Actions\Customer\Review;

use App\Models\ProductReview;
use App\Models\Store;

class CreateProductReviewAction
{
    public function execute(Store $store, int $productId, array $attributes): ProductReview
    {
        $product = $store->products()->where('status', 'active')->findOrFail($productId);

        return ProductReview::query()->create($attributes + [
            'store_id' => $store->id,
            'product_id' => $product->id,
        ]);
    }
}