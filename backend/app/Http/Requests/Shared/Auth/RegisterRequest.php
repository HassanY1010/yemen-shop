<?php

namespace App\Http\Requests\Shared\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'string', 'min:8'],
            'store_name' => ['required', 'string', 'max:255'],
            'store_slug' => ['nullable', 'string', 'max:255', Rule::unique('stores', 'slug')],
            'phone' => ['nullable', 'string', 'max:50'],
        ];
    }
}