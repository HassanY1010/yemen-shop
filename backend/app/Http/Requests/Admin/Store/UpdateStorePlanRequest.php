<?php

namespace App\Http\Requests\Admin\Store;

use Illuminate\Foundation\Http\FormRequest;

class UpdateStorePlanRequest extends FormRequest
{
    public function authorize(): bool { return $this->user()?->role === 'admin'; }

    public function rules(): array
    {
        return ['plan_id' => ['required', 'exists:plans,id']];
    }
}