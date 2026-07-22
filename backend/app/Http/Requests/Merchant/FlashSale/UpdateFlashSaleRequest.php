<?php

namespace App\Http\Requests\Merchant\FlashSale;

use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateFlashSaleRequest extends FormRequest
{
    public function authorize(): bool { return (bool) Tenant::storeFor($this->user()); }

    public function rules(): array
    {
        $store = Tenant::storeFor($this->user());

        return [
            'product_id' => ['sometimes', Rule::exists('products', 'id')->where('store_id', $store?->id)],
            'title' => ['sometimes', 'string', 'max:255'],
            'discount_type' => ['nullable', Rule::in(['percentage', 'fixed'])],
            'discount_value' => ['sometimes', 'numeric', 'min:0'],
            'start_at' => ['sometimes', 'date'],
            'end_at' => ['sometimes', 'date', 'after:start_at'],
            'max_quantity' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}