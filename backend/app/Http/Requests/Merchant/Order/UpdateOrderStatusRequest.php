<?php

namespace App\Http\Requests\Merchant\Order;

use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOrderStatusRequest extends FormRequest
{
    public function authorize(): bool { return (bool) Tenant::storeFor($this->user()); }

    public function rules(): array
    {
        return ['status' => ['required', Rule::in(['pending', 'processing', 'completed', 'cancelled'])]];
    }
}