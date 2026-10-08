<?php

namespace App\Services\Asaas;

use Illuminate\Http\Client\Response;
use RuntimeException;

class AsaasException extends RuntimeException
{
    /** @var array<int, string> mensagens de erro devolvidas pelo Asaas (já legíveis para o usuário) */
    public array $errors = [];

    /** @var array<int, string> códigos de erro do Asaas (ex.: invalid_mobilePhone) */
    public array $codes = [];

    public static function fromResponse(Response $response): self
    {
        $raw = collect($response->json('errors') ?? []);
        $errors = $raw->pluck('description')->filter()->values()->all();

        $e = new self(
            'Asaas respondeu '.$response->status().($errors ? ': '.implode(' | ', $errors) : ''),
            $response->status()
        );
        $e->errors = $errors;
        $e->codes = $raw->pluck('code')->filter()->values()->all();

        return $e;
    }

    /** Mensagem segura para mostrar no painel. */
    public function userMessage(): string
    {
        return $this->errors
            ? implode(' ', $this->errors)
            : 'Não foi possível processar a cobrança agora. Tente novamente em alguns minutos.';
    }
}
