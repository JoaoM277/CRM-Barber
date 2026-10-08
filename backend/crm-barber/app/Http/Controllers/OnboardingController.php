<?php

namespace App\Http\Controllers;

use App\Models\Instance;
use App\Models\Plan;
use App\Models\Schedule;
use App\Models\Service;
use App\Models\Worker;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Guia de primeiros passos do painel. Objetivo: a barbearia receber o
 * primeiro agendamento no primeiro dia.
 */
class OnboardingController extends Controller
{
    /** Passos confirmados manualmente (os demais são detectados pelos dados). */
    private const MANUAL = ['horarios', 'link'];

    /** Modelos de serviço para quem quer começar rápido (preço em R$, duração em minutos). */
    private const SERVICOS_PADRAO = [
        ['name' => 'Corte', 'price' => 40, 'duration_time' => 30],
        ['name' => 'Barba', 'price' => 30, 'duration_time' => 30],
        ['name' => 'Corte + Barba', 'price' => 65, 'duration_time' => 60],
        ['name' => 'Sobrancelha', 'price' => 15, 'duration_time' => 15],
    ];

    public function __construct(protected TenantContext $tenant) {}

    /** GET /onboarding */
    public function show(): JsonResponse
    {
        $bs = $this->tenant->barbershop();
        $flags = $bs->onboarding ?? [];
        $temWhatsapp = (bool) $bs->subscription?->hasFeature(Plan::FEATURE_WHATSAPP) || ! $bs->subscription;

        $passos = [
            ['id' => 'servicos', 'titulo' => 'Cadastre seus serviços', 'descricao' => 'Preço e duração de cada serviço que você oferece.', 'feito' => Service::exists()],
            ['id' => 'profissionais', 'titulo' => 'Cadastre os profissionais', 'descricao' => 'Quem atende — o cliente escolhe na hora de agendar.', 'feito' => Worker::exists()],
            ['id' => 'horarios', 'titulo' => 'Confira os horários de funcionamento', 'descricao' => 'Dias, horário de abertura, fechamento e almoço.', 'feito' => ! empty($flags['horarios'])],
        ];

        if ($temWhatsapp) {
            $passos[] = ['id' => 'whatsapp', 'titulo' => 'Conecte o WhatsApp', 'descricao' => 'Para o cliente receber a confirmação do agendamento automaticamente.', 'feito' => Instance::where('barbershop_id', $bs->id)->where('status', Instance::STATUS_CONECTADO)->exists()];
        }

        $passos[] = ['id' => 'link', 'titulo' => 'Divulgue seu link de agendamento', 'descricao' => 'Coloque na bio do Instagram e mande no WhatsApp dos clientes.', 'feito' => ! empty($flags['link'])];
        $passos[] = ['id' => 'agendamento', 'titulo' => 'Receba o primeiro agendamento', 'descricao' => 'Faça um teste você mesmo pelo link, se quiser.', 'feito' => Schedule::exists()];

        $feitos = collect($passos)->where('feito', true)->count();

        return response()->json([
            'passos' => $passos,
            'feitos' => $feitos,
            'total' => count($passos),
            'concluido' => $feitos === count($passos),
            'dispensado' => ! empty($flags['dispensado']),
            'slug' => $bs->slug,
        ]);
    }

    /** POST /onboarding/marcar {passo: horarios|link|dispensar} */
    public function mark(Request $request): JsonResponse
    {
        $data = $request->validate(['passo' => ['required', Rule::in([...self::MANUAL, 'dispensar'])]]);
        $bs = $this->tenant->barbershop();

        $flags = $bs->onboarding ?? [];
        $flags[$data['passo'] === 'dispensar' ? 'dispensado' : $data['passo']] = now()->toIso8601String();
        $bs->forceFill(['onboarding' => $flags])->save();

        return $this->show();
    }

    /** POST /onboarding/servicos-padrao — cria os modelos de serviço (só se ainda não houver nenhum). */
    public function defaultServices(): JsonResponse
    {
        if (Service::exists()) {
            return response()->json(['message' => 'Você já tem serviços cadastrados.'], 422);
        }

        foreach (self::SERVICOS_PADRAO as $s) {
            Service::create($s + ['active' => true]);
        }

        return response()->json(['message' => 'Serviços de exemplo criados. Ajuste preços e durações quando quiser.'], 201);
    }
}
