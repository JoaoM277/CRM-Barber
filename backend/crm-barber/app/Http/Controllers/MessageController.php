<?php

namespace App\Http\Controllers;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class MessageController extends Controller
{
    public function sendAppointmentConfirmation(Request $request)
    {
        $data = $request->validate([
            'clienteNome' => 'required|string|min:1|max:255',
            'clienteTelefone' => 'required|string|min:8|max:20',
            'dataAgendamento' => 'required|date',
            'horario' => 'required|string|max:10',
            'barbeiroNome' => 'nullable|string|max:255',
        ]);

        $messagePayload = [
            'phone' => preg_replace('/\D/', '', $data['clienteTelefone']),
            'name' => $data['clienteNome'],
            'trigger' => 'AGENDAMENTO',
            'date' => $data['dataAgendamento'],
            'time' => $data['horario'],
            'barber' => $data['barbeiroNome'] ?? null,
        ];

        try {
            $messageServiceUrl = rtrim(config('services.messages.url'), '/');
            $messageResponse = Http::timeout(5)->post("{$messageServiceUrl}/message", $messagePayload);
        } catch (ConnectionException $exception) {
            return response()->json([
                'message' => 'Agendamento recebido, mas o serviço de mensagens não respondeu.',
                'error' => $exception->getMessage(),
            ], 502);
        }

        return response()->json([
            'message' => 'Resposta do serviço de mensagens recebida.',
            'message_service' => $messageResponse->json(),
        ], $messageResponse->successful() ? 200 : 502);
    }
}
