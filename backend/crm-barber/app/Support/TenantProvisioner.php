<?php

namespace App\Support;

use App\Models\Barbershop;
use App\Models\OperationTime;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Cria uma barbearia nova + o usuário admin vinculado, com a grade de
 * horário padrão já semeada. Usado pelo cadastro público (AuthController)
 * e pelo comando artisan tenant:criar (onboarding interno de cliente).
 */
class TenantProvisioner
{
    /**
     * @param  array{name:string,email:string,password:string,barbershop_name:string,barbershop_phone?:?string,barbershop_whatsapp?:?string}  $data
     * @return array{0: User, 1: Barbershop}
     */
    public function create(array $data): array
    {
        return DB::transaction(function () use ($data) {
            $barbershop = Barbershop::create([
                'name' => $data['barbershop_name'],
                'slug' => $this->generateUniqueSlug($data['barbershop_name']),
                'phone' => $data['barbershop_phone'] ?? null,
                'whatsapp' => $data['barbershop_whatsapp'] ?? null,
            ]);

            $user = User::create([
                'barbershop_id' => $barbershop->id,
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
                'role' => User::ROLE_ADMIN,
            ]);

            $this->seedDefaultOperationTimes($barbershop->id);

            return [$user, $barbershop];
        });
    }

    /**
     * Grade de horário padrão pra barbearia recém-criada ficar utilizável na hora:
     * seg-sex 09:00-19:00 (almoço 12:00-13:00), sáb 09:00-17:00, dom fechado.
     */
    private function seedDefaultOperationTimes(int $barbershopId): void
    {
        $linhas = [];
        foreach (range(0, 6) as $dow) {
            $fechado = $dow === 0;
            $linhas[] = [
                'barbershop_id' => $barbershopId,
                'day_of_week' => $dow,
                'active' => ! $fechado,
                'start_time' => '09:00:00',
                'end_time' => $dow === 6 ? '17:00:00' : '19:00:00',
                'waiting_start' => $fechado || $dow === 6 ? null : '12:00:00',
                'waiting_end' => $fechado || $dow === 6 ? null : '13:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        OperationTime::insert($linhas);
    }

    /**
     * Gera um slug único para a barbearia a partir do nome.
     */
    private function generateUniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'barbearia';
        $slug = $base;
        $i = 1;

        while (Barbershop::where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }
}
