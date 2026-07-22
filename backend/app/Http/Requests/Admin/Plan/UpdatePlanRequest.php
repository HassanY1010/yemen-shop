<?php

namespace App\Http\Requests\Admin\Plan;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePlanRequest extends FormRequest
{
    public function authorize(): bool { return $this->user()?->role === 'admin'; }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string'],
            'slug' => ['sometimes', 'string', Rule::unique('plans')->ignore($this->route('id'))],
            'price' => ['sometimes', 'numeric', 'min:0'],
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