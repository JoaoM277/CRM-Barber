<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public const ROLE_ADMIN = 'admin';

    public const ROLE_USER = 'user';

    /** Dono da plataforma (painel universal). Não pertence a nenhuma barbearia. */
    public const ROLE_SUPER_ADMIN = 'super_admin';

    /** Prefixo do nome dos tokens de acesso de suporte (super admin entrando no painel de uma barbearia). */
    public const SUPPORT_TOKEN_PREFIX = 'suporte:';

    protected $fillable = [
        'barbershop_id',
        'name',
        'email',
        'password',
        'role',
        'terms_accepted_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'terms_accepted_at' => 'datetime',
        ];
    }

    /** E-mail de "esqueci minha senha" em português, com link para a página do painel. */
    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }

    public function barbershop()
    {
        return $this->belongsTo(Barbershop::class);
    }

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === self::ROLE_SUPER_ADMIN;
    }

    /** A requisição atual veio de um token de suporte (acesso do super admin)? */
    public function isSupportSession(): bool
    {
        $token = $this->currentAccessToken();

        return $token && isset($token->name) && str_starts_with($token->name, self::SUPPORT_TOKEN_PREFIX);
    }
}
