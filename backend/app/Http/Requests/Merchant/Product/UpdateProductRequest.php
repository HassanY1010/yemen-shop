<?php

namespace App\Http\Requests\Merchant\Product;

use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) Tenant::storeFor($this->user());
    }

    public function rules(): array
    {
        $store = Tenant::storeFor($this->user());

        return [
            'name' => ['sometimes', 'string'],
            'category_id' => ['nullable', Rule::exists('categories', 'id')->where('store_id', $store?->id)],
            'description' => ['nullable', 'string'],
            'short_description' => ['nullable', 'string'],
            'sku' => ['nullable', 'string'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'sale_price' => ['nullable', 'numeric', 'min:0'],
            'stock' => ['nullable', 'integer', 'min:0'],
            'manage_stock' => ['nullable', 'boolean'],
            'status' => ['nullable', Rule::in(['active', 'inactive', 'draft'])],
            'featured' => ['nullable', 'boolean'],
            'tags' => ['nullable', 'array'],
            'images' => ['nullable', 'array'],
            'images.*' => ['nullable', 'string'],
        ];
    }
}