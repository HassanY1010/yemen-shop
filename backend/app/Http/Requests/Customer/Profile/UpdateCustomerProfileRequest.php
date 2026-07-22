<?php

namespace App\Http\Requests\Customer\Profile;

use App\Models\Store;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCustomerProfileRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $store = Store::query()->where('slug', $this->route('slug'))->first();

        return [
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:50'],
            'email' => ['required', 'email', Rule::unique('customers', 'email')->where('store_id', $store?->id)->ignore($this->customerId())],
            'city' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:1000'],
        ];
    }

    private function customerId(): ?int
    {
        $token = $this->bearerToken() ?: $this->query('token');
        $decoded = $token ? base64_decode($token, true) : false;

        if (! $decoded) {
            return null;
        }

        [, $customerId] = array_pad(explode('|', $decoded), 2, null);

        return $customerId ? (int) $customerId : null;
    }
}