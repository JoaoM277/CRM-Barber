<?php

namespace App\Notifications;

use App\Models\SubscriptionPayment;
use App\Support\PlatformSettings;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Mensalidade vencida: avisa a carência e manda o link de pagamento. */
class PaymentOverdueNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public SubscriptionPayment $payment) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $valor = 'R$ '.number_format($this->payment->value_cents / 100, 2, ',', '.');
        $venc = $this->payment->due_date?->format('d/m/Y');
        $carencia = PlatformSettings::graceDays();
        $url = $this->payment->invoice_url ?: rtrim(config('app.panel_url'), '/').'/admin.html';

        return (new MailMessage)
            ->subject('Mensalidade em atraso — '.config('app.name'))
            ->greeting('Olá, '.$notifiable->name.'!')
            ->line("Não identificamos o pagamento da mensalidade de {$valor}, vencida em {$venc}.")
            ->line("O painel continua funcionando por mais {$carencia} dia(s). Depois disso ele fica em modo leitura até a regularização.")
            ->action('Pagar agora', $url)
            ->line('Se você já pagou, desconsidere: a confirmação pode levar algumas horas.')
            ->salutation('Equipe '.config('app.name'));
    }
}
