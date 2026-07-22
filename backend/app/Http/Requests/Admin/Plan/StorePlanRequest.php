<?php

namespace App\Http\Requests\Admin\Plan;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePlanRequest extends FormRequest
{
    public function authorize(): bool { return $this->user()?->role === 'admin'; }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string'],
            'slug' => ['required', 'string', Rule::unique('plans')],
            'price' => ['required', 'numeric', 'min:0'],
            'billing_cycle' => ['nullable', 'string'],
            'max_products' => ['nullable', 'integer'],
            'max_images' => ['nullable', 'integer'],
            'max_staff' => ['nullable', 'integer'],
            'max_orders' => ['nullable', 'integer'],
            'features' => ['nullable', 'array'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}