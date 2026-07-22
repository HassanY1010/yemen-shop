<?php

namespace App\Http\Requests\Shared;

use Illuminate\Foundation\Http\FormRequest;

class UploadFileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user();
    }

    public function rules(): array
    {
        return ['file' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,gif,svg', 'max:5120']];
    }
}