<?php

namespace App\Http\Requests\Merchant\Variant;

use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;

class SyncProductVariantsRequest extends FormRequest
{
    public function authorize(): bool { return (bool) Tenant::storeFor($this->user()); }

    public function rules(): array
    {
        return [
            'variants' => ['required', 'array'],
            'variants.*.type' => ['required', 'string', 'max:100'],
            'variants.*.value' => ['required', 'string', 'max:255'],
            'variants.*.price_modifier' => ['nullable', 'numeric'],
            'variants.*.stock' => ['nullable', 'integer', 'min:0'],
            'variants.*.sku' => ['nullable', 'string', 'max:255'],
            'variants.*.is_active' => ['nullable', 'boolean'],
        ];
    }
}