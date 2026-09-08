<?php

namespace App\Support;

use App\Models\Barbershop;

/**
 * Guarda a barbearia (tenant) do request atual. É registrado como singleton
 * no container, então o mesmo objeto é compartilhado durante todo o ciclo do
 * request. O middleware de tenant preenche; o trait BelongsToTenant lê.
 */
class TenantContext
{
    protected ?int $barbershopId = null;

    protected ?Barbershop $barbershop = null;

    public function set(Barbershop|int $barbershop): void
    {
        if ($barbershop instanceof Barbershop) {
            $this->barbershop = $barbershop;
            $this->barbershopId = $barbershop->id;

            return;
        }

        $this->barbershopId = $barbershop;
        $this->barbershop = null;
    }

    public function id(): ?int
    {
        return $this->barbershopId;
    }

    public function barbershop(): ?Barbershop
    {
        if ($this->barbershop === null && $this->barbershopId !== null) {
            $this->barbershop = Barbershop::find($this->barbershopId);
        }

        return $this->barbershop;
    }

    public function has(): bool
    {
        return $this->barbershopId !== null;
    }

    public function forget(): void
    {
        $this->barbershopId = null;
        $this->barbershop = null;
    }
}
