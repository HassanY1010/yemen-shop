<?php

namespace App\Http\Requests\Merchant\Coupon;

use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCouponRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) Tenant::storeFor($this->user());
    }

    public function rules(): array
    {
        $store = Tenant::storeFor($this->user());

        return [
            'code' => ['required', 'string', Rule::unique('coupons')->where('store_id', $store?->id)],
            'type' => ['required', Rule::in(['percentage', 'fixed'])],
            'value' => ['required', 'numeric', 'min:0'],
            'min_order_amount' => ['nullable', 'numeric', 'min:0'],
            'max_uses' => ['nullable', 'integer', 'min:1'],
            'expires_at' => ['nullable', 'date'],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}