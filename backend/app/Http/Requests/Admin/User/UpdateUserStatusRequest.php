<?php

namespace App\Http\Requests\Admin\User;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserStatusRequest extends FormRequest
{
    public function authorize(): bool { return $this->user()?->role === 'admin'; }

    public function rules(): array
    {
        return ['is_active' => ['required', 'boolean']];
    }
}