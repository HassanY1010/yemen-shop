<?php

namespace App\Actions\Merchant\Category;

use App\DTOs\Merchant\Category\CategoryData;
use App\Models\Category;
use App\Models\Store;
use App\Support\Tenant;

class CreateCategoryAction
{
    public function execute(Store $store, CategoryData $data): Category
    {
        $attributes = $data->attributes;
        $attributes['store_id'] = $store->id;
        $attributes['slug'] = Tenant::slug($attributes['name'], 'categories', $store->id);

        return $store->categories()->create($attributes);
    }
}