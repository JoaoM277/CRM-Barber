<?php

namespace App\Http\Requests;

use App\Support\Phone;
use App\Support\TenantContext;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreClientRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Normaliza o telefone antes da checagem de unicidade — o model também
     * normaliza no set, mas aqui garante que o unique compare valores iguais.
     */
    protected function prepareForValidation(): void
    {
        if ($this->filled('phone')) {
            $this->merge(['phone' => Phone::normalizeBr((string) $this->input('phone'))]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $tenantId = app(TenantContext::class)->id();

        return [
            'name' => 'required|string|max:255',
            'email' => ['nullable', 'email', Rule::unique('clients', 'email')->where('barbershop_id', $tenantId)->whereNull('deleted_at')],
            'phone' => ['required', 'string', 'max:20', Rule::unique('clients', 'phone')->where('barbershop_id', $tenantId)->whereNull('deleted_at')],
            'birth_date' => 'nullable|date',
            'observation' => 'nullable|string',
        ];
    }
}
