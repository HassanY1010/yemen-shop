<?php

namespace App\Http\Requests\Merchant\Staff;

use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreStaffRequest extends FormRequest
{
    public function authorize(): bool { return (bool) Tenant::storeFor($this->user()); }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string'],
            'email' => ['required', 'email', Rule::unique('users')],
            'phone' => ['nullable', 'string'],
            'password' => ['required', 'string', 'min:8'],
            'permissions' => ['nullable', 'array'],
        ];
    }
}