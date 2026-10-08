<?php

namespace Tests\Feature;

use App\Jobs\SendAppointmentWhatsapp;
use App\Models\Barbershop;
use App\Models\Client;
use App\Models\Instance;
use App\Models\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Bus;
use Tests\TestCase;

class LembretesTest extends TestCase
{
    use RefreshDatabase;

    private Barbershop $bs;

    private Client $cliente;

    protected function setUp(): void
    {
        parent::setUp();
        Bus::fake();
        Carbon::setTestNow('2026-10-08 11:00:00');
        $this->bs = Barbershop::factory()->create();
        $this->cliente = Client::factory()->create(['barbershop_id' => $this->bs->id, 'phone' => '5511987654321']);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function agendamento(string $data, string $hora, array $over = []): Schedule
    {
        $s = Schedule::factory()->create(array_merge([
            'barbershop_id' => $this->bs->id, 'client_id' => $this->cliente->id,
            'date' => $data, 'start_time' => "$hora:00", 'end_time' => '23:59:00', 'status' => Schedule::STATUS_PENDENTE,
        ], $over));
        $s->forceFill(['created_at' => now()->subDays(2)])->save();

        return $s;
    }

    private function enviados(string $gatilho): int
    {
        return Bus::dispatched(SendAppointmentWhatsapp::class, fn ($j) => $j->trigger === $gatilho)->count();
    }

    // ------------------------------------------------------------ envio

    public function test_lembrete_de_24h_sai_uma_vez(): void
    {
        $s = $this->agendamento('2026-10-09', '10:00'); // faltam 23h

        $this->artisan('lembretes:enviar')->assertSuccessful();
        $this->artisan('lembretes:enviar')->assertSuccessful();

        $this->assertSame(1, $this->enviados(SendAppointmentWhatsapp::LEMBRETE_24H));
        $this->assertNotNull($s->fresh()->lembrete_24h_em);
    }

    public function test_lembrete_de_2h(): void
    {
        $this->agendamento('2026-10-08', '12:30'); // faltam 1h30

        $this->artisan('lembretes:enviar');

        $this->assertSame(1, $this->enviados(SendAppointmentWhatsapp::LEMBRETE_2H));
        $this->assertSame(0, $this->enviados(SendAppointmentWhatsapp::LEMBRETE_24H));
    }

    public function test_nada_sai_de_madrugada_nem_com_lembretes_desligados(): void
    {
        $this->agendamento('2026-10-09', '10:00');

        $this->artisan('lembretes:enviar', ['--agora' => '2026-10-08 23:00'])->assertSuccessful();
        $this->bs->update(['lembretes_whatsapp' => false]);
        $this->artisan('lembretes:enviar')->assertSuccessful();

        Bus::assertNotDispatched(SendAppointmentWhatsapp::class);
    }

    public function test_quem_marcou_em_cima_da_hora_e_cancelados_nao_recebem(): void
    {
        $recente = $this->agendamento('2026-10-08', '12:30');
        $recente->forceFill(['created_at' => now()->subMinutes(30)])->save();
        $this->agendamento('2026-10-09', '10:00', ['status' => Schedule::STATUS_CANCELADO]);

        $this->artisan('lembretes:enviar');

        Bus::assertNotDispatched(SendAppointmentWhatsapp::class);
    }

    // ------------------------------------------------------------ resposta do cliente

    private function resposta(string $texto, string $jid = '5511987654321@s.whatsapp.net', string $token = 'tok-evo', bool $fromMe = false)
    {
        return $this->postJson("/api/webhooks/evolution/{$token}", [
            'event' => 'messages.upsert',
            'instance' => 'loja-x1',
            'data' => ['key' => ['remoteJid' => $jid, 'fromMe' => $fromMe], 'message' => ['conversation' => $texto]],
        ]);
    }

    private function prepararResposta(): Schedule
    {
        config(['services.evolution.webhook_token' => 'tok-evo']);
        Instance::create(['barbershop_id' => $this->bs->id, 'name' => 'loja-x1', 'status' => Instance::STATUS_CONECTADO]);

        return $this->agendamento('2026-10-09', '10:00', ['lembrete_24h_em' => now()]);
    }

    public function test_cliente_responde_1_e_confirma(): void
    {
        $s = $this->prepararResposta();

        $this->resposta(' Sim! ')->assertOk()->assertJsonPath('resultado', 'confirmar');

        $this->assertSame(Schedule::STATUS_CONFIRMADO, $s->fresh()->status);
        $this->assertSame(1, $this->enviados(SendAppointmentWhatsapp::RESPOSTA_CONFIRMADO));
    }

    public function test_cliente_responde_2_e_cancela_mesmo_sem_o_nono_digito(): void
    {
        $s = $this->prepararResposta();

        // o WhatsApp identificou o número antigo, sem o 9
        $this->resposta('2', '551187654321@s.whatsapp.net')->assertOk()->assertJsonPath('resultado', 'cancelar');

        $this->assertSame(Schedule::STATUS_CANCELADO, $s->fresh()->status);
        $this->assertSame(1, $this->enviados(SendAppointmentWhatsapp::RESPOSTA_CANCELADO));
    }

    public function test_conversa_comum_mensagem_propria_e_token_errado_sao_ignorados(): void
    {
        $s = $this->prepararResposta();

        $this->resposta('oi, que horas vocês abrem amanhã?')->assertJsonPath('resultado', 'ignorado');
        $this->resposta('1', fromMe: true)->assertJsonPath('resultado', 'ignorado');
        $this->resposta('1', token: 'errado')->assertUnauthorized();

        $this->assertSame(Schedule::STATUS_PENDENTE, $s->fresh()->status);
        Bus::assertNotDispatched(SendAppointmentWhatsapp::class);
    }
}
