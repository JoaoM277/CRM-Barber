<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreScheduleRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Contrato usado pela tela pública de agendamento (front-end/js/script.js).
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'clienteNome' => 'required|string|max:255',
            'clienteTelefone' => 'required|string|max:20',
            'barbeiroId' => 'required|integer|exists:workers,id',
            'servicosIds' => 'required|array|min:1|max:20',
            'servicosIds.*' => 'integer|distinct|exists:services,id',
            'dataAgendamento' => 'required|date',
            'horario' => ['required', 'regex:/^\d{2}:\d{2}$/'],
            'observacoes' => 'nullable|string|max:1000',
            // honeypot anti-bot: campo escondido no front que uma pessoa nunca
            // preenche; se vier algo aqui, rejeita como se fosse validação normal.
            'website' => 'nullable|string|max:0',
        ];
    }
}
