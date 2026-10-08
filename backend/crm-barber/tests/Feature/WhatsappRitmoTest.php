<?php

namespace Tests\Feature;

use App\Jobs\SendAppointmentWhatsapp;
use App\Models\Barbershop;
use App\Models\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

/** Limite de ritmo de mensagens por barbearia (protege o número contra bloqueio). */
class WhatsappRitmoTest extends TestCase
{
    use RefreshDatabase;

    public function test_acima_do_limite_por_minuto_a_mensagem_e_adiada_e_nao_enviada(): void
    {
        Http::fake(['*' => Http::response(['status' => 'dispatched'])]);
        $bs = Barbershop::factory()->create();
        $schedule = Schedule::factory()->create(['barbershop_id' => $bs->id]);

        // dentro do limite: envia
        (new SendAppointmentWhatsapp($schedule->id))->handle();
        Http::assertSentCount(1);

        // estoura o limite da barbearia: o job volta para a fila sem enviar
        for ($i = 0; $i < SendAppointmentWhatsapp::POR_MINUTO; $i++) {
            RateLimiter::hit('whatsapp-envios:'.$bs->id, 60);
        }
        (new SendAppointmentWhatsapp($schedule->id))->handle();
        Http::assertSentCount(1);

        // o limite é por barbearia: outra barbearia continua enviando
        $outra = Schedule::factory()->create(['barbershop_id' => Barbershop::factory()->create()->id]);
        (new SendAppointmentWhatsapp($outra->id))->handle();
        Http::assertSentCount(2);
    }
}
