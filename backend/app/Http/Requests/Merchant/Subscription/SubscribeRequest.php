<?php

namespace App\Http\Requests\Merchant\Subscription;

use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;

class SubscribeRequest extends FormRequest
{
    public function authorize(): bool { return (bool) Tenant::storeFor($this->user()); }

    public function rules(): array
    {
        return ['plan_id' => ['required', 'exists:plans,id']];
    }
}