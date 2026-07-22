<?php

namespace App\Http\Requests\Merchant\Coupon;

use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;

class ValidateCouponRequest extends FormRequest
{
    public function authorize(): bool { return (bool) Tenant::storeFor($this->user()); }

    public function rules(): array
    {
        return [
            'code' => ['required', 'string'],
            'order_total' => ['nullable', 'numeric', 'min:0'],
            'total' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    public function total(): float
    {
        return (float) ($this->validated('order_total') ?? $this->validated('total') ?? 0);
    }
}