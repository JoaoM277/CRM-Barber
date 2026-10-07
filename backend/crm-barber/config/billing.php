<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Regras da assinatura
    |--------------------------------------------------------------------------
    */

    // Dias de teste grátis (sem cartão) para barbearias novas.
    'trial_days' => (int) env('BILLING_TRIAL_DAYS', 14),

    // Plano usado durante o trial (o mais completo, para experimentar tudo).
    'trial_plan' => env('BILLING_TRIAL_PLAN', 'premium'),

    // Dias de carência depois do vencimento antes do painel ficar só leitura.
    'grace_days' => (int) env('BILLING_GRACE_DAYS', 7),

    /*
    |--------------------------------------------------------------------------
    | Asaas
    |--------------------------------------------------------------------------
    | Chave e token ficam no .env. Em sandbox, crie a conta em
    | https://sandbox.asaas.com e gere a chave em Integrações.
    | O webhook deve apontar para {APP_URL}/api/webhooks/asaas com o mesmo
    | token configurado em ASAAS_WEBHOOK_TOKEN.
    */
    'asaas' => [
        'env' => env('ASAAS_ENV', 'sandbox'),
        'api_key' => env('ASAAS_API_KEY'),
        'webhook_token' => env('ASAAS_WEBHOOK_TOKEN'),
        'base_url' => env('ASAAS_BASE_URL') ?: (env('ASAAS_ENV', 'sandbox') === 'production'
            ? 'https://api.asaas.com/v3'
            : 'https://api-sandbox.asaas.com/v3'),
        'timeout' => (int) env('ASAAS_TIMEOUT', 15),
    ],

];
