<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreBarbershopRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:barbershops,slug',

            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|unique:barbershops,email',

            'zip_code' => 'nullable|string|max:10',
            'street' => 'nullable|string|max:255',
            'number' => 'nullable|string|max:20',
            'complement' => 'nullable|string|max:255',
            'neighborhood' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'state' => 'nullable|string|size:2',

            'logo' => 'nullable|string|max:255',

            'opening_time' => 'nullable|date_format:H:i',
            'closing_time' => 'nullable|date_format:H:i',

            'whatsapp' => 'nullable|string|max:20',
            'instagram' => 'nullable|string|max:255',
            'website' => 'nullable|url|max:255',

            'timezone' => 'nullable|string|max:100',

            'subscription_plan' => 'nullable|in:free,basic,premium',
            'subscription_ends_at' => 'nullable|date',

            'active' => 'nullable|boolean',
        ];
    }
}
