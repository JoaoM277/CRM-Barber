<?php

namespace App\Notifications;

use App\Models\Subscription;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Teste grátis acabando (ou acabou) sem plano escolhido. */
class TrialEndingNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Subscription $subscription, public bool $ended = false) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = rtrim(config('app.panel_url'), '/').'/admin.html';
        $fim = $this->subscription->trial_ends_at?->format('d/m/Y');
        $nome = $this->subscription->barbershop?->name ?? 'sua barbearia';

        $msg = (new MailMessage)->greeting('Olá, '.$notifiable->name.'!');

        if ($this->ended) {
            return $msg
                ->subject('Seu teste grátis terminou — '.config('app.name'))
                ->line("O teste grátis da {$nome} terminou em {$fim}.")
                ->line('O painel está em modo leitura e o agendamento online foi pausado. Seus dados continuam guardados.')
                ->action('Escolher um plano', $url)
                ->line('Assim que o pagamento for confirmado, tudo volta a funcionar na hora.')
                ->salutation('Equipe '.config('app.name'));
        }

        return $msg
            ->subject('Seu teste grátis termina em breve — '.config('app.name'))
            ->line("O teste grátis da {$nome} termina em {$fim}.")
            ->line('Escolha um plano para continuar recebendo agendamentos sem interrupção. A primeira cobrança só vence no fim do teste.')
            ->action('Escolher um plano', $url)
            ->salutation('Equipe '.config('app.name'));
    }
}
