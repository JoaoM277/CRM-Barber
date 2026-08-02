<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreMessageRequest extends FormRequest
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
            'clienteNome' => 'required|string|min:1|max:255',
            'clienteTelefone' => 'required|string|min:8|max:20',
            'dataAgendamento' => 'required|date',
            'horario' => 'required|string|max:10',
            'barbeiroNome' => 'nullable|string|max:255',
        ];
    }
}
