<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\ApiResponse;
use App\Http\Requests\StoreMessageRequest;
use Exception;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class MessageController extends Controller
{
    use ApiResponse;

    public function sendAppointmentConfirmation(StoreMessageRequest $request)
    {
        try {
            $data = $request->validated();

            if (! str_starts_with($data['clienteTelefone'], '55')) {
                $data['clienteTelefone'] = '55'.$data['clienteTelefone'];
            }

            $messagePayload = [
                'phone' => preg_replace('/\D/', '', $data['clienteTelefone']),
                'name' => $data['clienteNome'],
                'trigger' => 'AGENDAMENTO',
                'date' => $data['dataAgendamento'],
                'time' => $data['horario'],
                'barber' => $data['barbeiroNome'] ?? null,
            ];

            $messageServiceUrl = rtrim(config('services.messages.url'), '/');
            $messageResponse = Http::timeout(5)->post("{$messageServiceUrl}/message", $messagePayload);

            if (! $messageResponse->successful()) {
                return $this->Error(
                    errors: $messageResponse->json(),
                    message: 'Agendamento recebido, mas o serviço de mensagens retornou erro.',
                    statusCode: 502
                );
            }

            return $this->Success(
                data: $messageResponse->json(),
                message: 'Resposta do serviço de mensagens recebida.',
                statusCode: 200
            );
        } catch (ConnectionException $e) {
            return $this->Error(
                errors: $e->getMessage(),
                message: 'Agendamento recebido, mas o serviço de mensagens não respondeu.',
                statusCode: 502
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao enviar confirmação de agendamento!',
                statusCode: 400
            );
        }
    }
}
