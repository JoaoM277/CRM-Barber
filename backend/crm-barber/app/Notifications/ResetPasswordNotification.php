<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** "Esqueci minha senha": link para a página de redefinição no painel. */
class ResetPasswordNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $token) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = rtrim(config('app.panel_url'), '/').'/redefinir-senha.html?'.http_build_query([
            'token' => $this->token,
            'email' => $notifiable->email,
        ]);
        $minutos = config('auth.passwords.users.expire');

        return (new MailMessage)
            ->subject('Redefinir sua senha — '.config('app.name'))
            ->greeting('Olá, '.$notifiable->name.'!')
            ->line('Recebemos um pedido para redefinir a senha da sua conta.')
            ->action('Criar nova senha', $url)
            ->line("O link vale por {$minutos} minutos.")
            ->line('Se não foi você, ignore este e-mail: sua senha continua a mesma.')
            ->salutation('Equipe '.config('app.name'));
    }
}
