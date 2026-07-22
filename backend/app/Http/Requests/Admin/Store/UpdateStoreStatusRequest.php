<?php

namespace App\Http\Requests\Admin\Store;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStoreStatusRequest extends FormRequest
{
    public function authorize(): bool { return $this->user()?->role === 'admin'; }

    public function rules(): array
    {
        return ['status' => ['required', Rule::in(['active', 'suspended', 'inactive'])]];
    }
}