<?php

namespace App\Http\Requests\Customer\Order;

use Illuminate\Foundation\Http\FormRequest;

class StoreOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $payload = $this->all();

        if (! isset($payload['customer']) || ! is_array($payload['customer'])) {
            $payload['customer'] = [
                'name' => $payload['customer_name'] ?? $payload['name'] ?? null,
                'email' => $payload['customer_email'] ?? $payload['email'] ?? null,
                'phone' => $payload['customer_phone'] ?? $payload['phone'] ?? null,
            ];
        }

        $this->merge($payload);
    }

    public function rules(): array
    {
        return [
            'customer.name' => ['required', 'string', 'max:255'],
            'customer.email' => ['nullable', 'email', 'max:255'],
            'customer.phone' => ['nullable', 'string', 'max:50'],
            'shipping_address' => ['nullable', 'string'],
            'shipping_city' => ['nullable', 'string', 'max:100'],
            'payment_method' => ['nullable', 'string', 'max:100'],
            'coupon_code' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'items.*.variant_value' => ['nullable', 'string'],
        ];
    }
}