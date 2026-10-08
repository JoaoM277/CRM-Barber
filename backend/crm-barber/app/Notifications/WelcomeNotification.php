<?php

namespace App\Notifications;

use App\Models\Barbershop;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Boas-vindas logo após o cadastro, com os primeiros passos e o link de agendamento. */
class WelcomeNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Barbershop $barbershop, public int $trialDays) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $painel = rtrim(config('app.panel_url'), '/').'/login.html';
        $agendamento = rtrim(config('app.frontend_url'), '/').'/?b='.$this->barbershop->slug;

        return (new MailMessage)
            ->subject('Bem-vindo(a) ao '.config('app.name').'!')
            ->greeting('Olá, '.$notifiable->name.'!')
            ->line("A {$this->barbershop->name} já está no ar. Você tem {$this->trialDays} dias grátis, com todos os recursos liberados.")
            ->line('Para receber o primeiro agendamento ainda hoje:')
            ->line('1. Cadastre seus serviços e preços')
            ->line('2. Cadastre os profissionais')
            ->line('3. Confira os horários de funcionamento')
            ->line('4. Divulgue o seu link de agendamento: '.$agendamento)
            ->action('Abrir meu painel', $painel)
            ->line('Qualquer dúvida, é só responder este e-mail.')
            ->salutation('Equipe '.config('app.name'));
    }
}
