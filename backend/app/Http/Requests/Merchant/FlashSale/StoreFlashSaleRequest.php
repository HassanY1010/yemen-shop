<?php

namespace App\Http\Requests\Merchant\FlashSale;

use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFlashSaleRequest extends FormRequest
{
    public function authorize(): bool { return (bool) Tenant::storeFor($this->user()); }

    public function rules(): array
    {
        $store = Tenant::storeFor($this->user());

        return [
            'product_id' => ['required', Rule::exists('products', 'id')->where('store_id', $store?->id)],
            'title' => ['required', 'string', 'max:255'],
            'discount_type' => ['nullable', Rule::in(['percentage', 'fixed'])],
            'discount_value' => ['required', 'numeric', 'min:0'],
            'start_at' => ['required', 'date'],
            'end_at' => ['required', 'date', 'after:start_at'],
            'max_quantity' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}