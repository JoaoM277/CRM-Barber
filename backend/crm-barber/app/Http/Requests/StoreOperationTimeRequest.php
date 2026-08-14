<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreOperationTimeRequest extends FormRequest
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
            'day_of_week' => 'required|date_format:d/m/Y',
            'start_time' => 'required|integer|between:0,23',
            'end_time' => 'required|integer|between:0,23|gt:start_time',
            'waiting_start' => 'required|integer|between:0,23|gte:start_time|lte:end_time',
            'waiting_end' => 'required|integer|between:0,23|gt:waiting_start|lte:end_time',
        ];
    }
}
