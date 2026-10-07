<?php

namespace App\Services\Asaas;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Cliente HTTP mínimo da API v3 do Asaas — só o que a assinatura do SaaS usa.
 * Docs: https://docs.asaas.com/reference
 */
class AsaasClient
{
    public function createCustomer(array $data): array
    {
        return $this->send('post', '/customers', $data);
    }

    public function updateCustomer(string $customerId, array $data): array
    {
        return $this->send('put', "/customers/{$customerId}", $data);
    }

    /**
     * @param  array{customer:string,billingType:string,value:float,nextDueDate:string,cycle:string,description?:string,externalReference?:string}  $data
     */
    public function createSubscription(array $data): array
    {
        return $this->send('post', '/subscriptions', $data);
    }

    public function updateSubscription(string $subscriptionId, array $data): array
    {
        return $this->send('put', "/subscriptions/{$subscriptionId}", $data);
    }

    public function deleteSubscription(string $subscriptionId): array
    {
        return $this->send('delete', "/subscriptions/{$subscriptionId}");
    }

    /** Cobranças geradas pela assinatura (a mais recente primeiro). */
    public function subscriptionPayments(string $subscriptionId): array
    {
        return $this->send('get', "/subscriptions/{$subscriptionId}/payments")['data'] ?? [];
    }

    protected function request(): PendingRequest
    {
        $key = config('billing.asaas.api_key');

        if (! $key) {
            throw new AsaasException('ASAAS_API_KEY não configurada.');
        }

        return Http::baseUrl(config('billing.asaas.base_url'))
            ->withHeaders([
                'access_token' => $key,
                // o Asaas exige User-Agent nas contas novas
                'User-Agent' => config('app.name', 'CRM-Barber'),
            ])
            ->acceptJson()
            ->asJson()
            ->timeout(config('billing.asaas.timeout'));
    }

    protected function send(string $method, string $path, array $data = []): array
    {
        try {
            /** @var Response $response */
            $response = $this->request()->{$method}($path, $data);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            throw new AsaasException('Não foi possível falar com o Asaas: '.$e->getMessage(), previous: $e);
        }

        if ($response->failed()) {
            throw AsaasException::fromResponse($response);
        }

        return $response->json() ?? [];
    }
}
