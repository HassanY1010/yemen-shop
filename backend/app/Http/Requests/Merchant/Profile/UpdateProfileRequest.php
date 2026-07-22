<?php

namespace App\Http\Requests\Merchant\Profile;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool { return (bool) $this->user(); }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string'],
            'phone' => ['nullable', 'string'],
        ];
    }
}