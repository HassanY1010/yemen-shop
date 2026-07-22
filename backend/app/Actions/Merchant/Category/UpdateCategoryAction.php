<?php

namespace App\Actions\Merchant\Category;

use App\DTOs\Merchant\Category\CategoryData;
use App\Models\Category;
use App\Models\Store;
use App\Support\Tenant;

class UpdateCategoryAction
{
    public function execute(Store $store, Category $category, CategoryData $data): Category
    {
        $attributes = $data->attributes;
        $attributes['slug'] = Tenant::slug($attributes['name'], 'categories', $store->id, $category->id);
        $category->update($attributes);

        return $category;
    }
}