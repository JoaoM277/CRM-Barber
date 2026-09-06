<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreOperationTimeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'day_of_week' => 'required|integer|between:0,6',
            'active' => 'sometimes|boolean',
            'start_time' => ['required', 'regex:/^\d{2}:\d{2}$/'],
            'end_time' => ['required', 'regex:/^\d{2}:\d{2}$/'],
            'waiting_start' => ['nullable', 'regex:/^\d{2}:\d{2}$/'],
            'waiting_end' => ['nullable', 'regex:/^\d{2}:\d{2}$/'],
        ];
    }
}
