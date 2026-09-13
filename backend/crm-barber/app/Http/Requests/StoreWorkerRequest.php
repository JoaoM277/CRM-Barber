<?php

namespace App\Http\Requests;

use App\Support\TenantContext;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreWorkerRequest extends FormRequest
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
            // exclui soft-deleted: um telefone de profissional excluído pode ser reusado (vira restore)
            'phone' => ['required', 'string', 'max:20', Rule::unique('workers', 'phone')->where('barbershop_id', app(TenantContext::class)->id())->whereNull('deleted_at')],
            'photo' => 'nullable|string',
            'speciality' => 'nullable|string',
            'active' => 'boolean',
            'payment_type' => ['sometimes', \Illuminate\Validation\Rule::in(\App\Models\Worker::PAYMENT_TYPES)],
            'commission_percent' => 'sometimes|nullable|numeric|min:0|max:100',
            'fixed_salary' => 'sometimes|nullable|numeric|min:0',
            'pix_key' => 'sometimes|nullable|string|max:255',
        ];
    }
}
