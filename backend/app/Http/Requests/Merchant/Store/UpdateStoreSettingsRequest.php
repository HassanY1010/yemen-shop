<?php

namespace App\Http\Requests\Merchant\Store;

use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStoreSettingsRequest extends FormRequest
{
    public function authorize(): bool { return (bool) Tenant::storeFor($this->user()); }

    public function rules(): array
    {
        $store = Tenant::storeFor($this->user());

        return [
            'name' => ['sometimes', 'string'],
            'description' => ['nullable', 'string'],
            'phone' => ['nullable', 'string'],
            'email' => ['nullable', 'email'],
            'address' => ['nullable', 'string'],
            'city' => ['nullable', 'string'],
            'country' => ['nullable', 'string'],
            'currency' => ['nullable', 'string'],
            'primary_color' => ['nullable', 'string'],
            'secondary_color' => ['nullable', 'string'],
            'facebook' => ['nullable', 'string'],
            'twitter' => ['nullable', 'string'],
            'instagram' => ['nullable', 'string'],
            'whatsapp' => ['nullable', 'string'],
            'custom_domain' => ['nullable', 'string', Rule::unique('stores')->ignore($store?->id)],
            'google_analytics_id' => ['nullable', 'string'],
            'meta_pixel_id' => ['nullable', 'string'],
            'shipping_rates' => ['nullable', 'array'],
            'logo' => ['nullable', 'string'],
            'banner' => ['nullable', 'string'],
        ];
    }
}