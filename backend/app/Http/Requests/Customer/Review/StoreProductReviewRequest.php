<?php

namespace App\Http\Requests\Customer\Review;

use App\Models\Store;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProductReviewRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $store = Store::query()->where('slug', $this->route('slug'))->first();

        return [
            'customer_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->where('store_id', $store?->id)],
            'customer_name' => ['required', 'string', 'max:255'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ];
    }
}