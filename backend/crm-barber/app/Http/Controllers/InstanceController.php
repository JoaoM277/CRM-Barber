<?php

namespace App\Http\Controllers;

use App\Models\Instance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rule;

class InstanceController extends Controller
{
    private string $baseUrl;

    public function __construct()
    {
        $this->baseUrl = rtrim(config('services.messages.url'), '/');
    }

    /**
     * Lista as instâncias da barbearia do usuário logado (dados locais).
     */
    public function index(Request $request): JsonResponse
    {
        $instances = Instance::where('barbershop_id', $request->user()->barbershop_id)
            ->orderByDesc('id')
            ->get();

        return response()->json(['data' => $instances]);
    }

    /**
     * Cria a instância local + no provedor (Evolution) e devolve o QR Code.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60', 'regex:/^[A-Za-z0-9_-]+$/', Rule::unique('instances', 'name')],
        ]);

        $instance = Instance::create([
            'barbershop_id' => $request->user()->barbershop_id,
            'name' => $data['name'],
            'status' => Instance::STATUS_CONECTANDO,
        ]);

        try {
            $res = Http::timeout(20)->post("{$this->baseUrl}/instance/create", ['name' => $instance->name]);
        } catch (\Throwable $e) {
            $instance->update(['status' => Instance::STATUS_ERRO]);

            return response()->json(['message' => 'Serviço de mensagens indisponível.', 'error' => $e->getMessage()], 502);
        }

        $body = $res->json();

        if (! $res->successful()) {
            $instance->update(['status' => Instance::STATUS_ERRO]);

            return response()->json(['message' => 'Falha ao criar a instância no provedor.', 'provider' => $body], 502);
        }

        return response()->json([
            'message' => 'Instância criada. Escaneie o QR Code no WhatsApp.',
            'instance' => $instance->fresh(),
            'qrCode' => data_get($body, 'qrCode') ?? data_get($body, 'data.qrCode'),
            'status' => data_get($body, 'status'),
        ], 201);
    }

    /**
     * Gera um QR Code novo (reconectar).
     */
    public function qrcode(Request $request, Instance $instance): JsonResponse
    {
        $this->assertOwnership($request, $instance);

        try {
            $res = Http::timeout(20)->post("{$this->baseUrl}/instance/connect", ['name' => $instance->name]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Serviço de mensagens indisponível.'], 502);
        }

        $body = $res->json();

        return response()->json([
            'qrCode' => data_get($body, 'qrCode'),
            'status' => data_get($body, 'status'),
            'message' => data_get($body, 'message'),
        ], $res->successful() ? 200 : 502);
    }

    /**
     * Consulta o estado da conexão no provedor e atualiza o status local.
     */
    public function status(Request $request, Instance $instance): JsonResponse
    {
        $this->assertOwnership($request, $instance);

        try {
            $res = Http::timeout(15)->post("{$this->baseUrl}/instance/verify", ['name' => $instance->name]);
        } catch (\Throwable $e) {
            return response()->json(['status' => $instance->status, 'raw' => null, 'offline' => true]);
        }

        $raw = data_get($res->json(), 'status');
        $instance->status = Instance::mapEvolutionState($raw);
        if ($instance->status === Instance::STATUS_CONECTADO) {
            $instance->last_connected_at = now();
        }
        $instance->save();

        return response()->json(['status' => $instance->status, 'raw' => $raw]);
    }

    /**
     * Desconecta + apaga no provedor e remove o registro local.
     */
    public function destroy(Request $request, Instance $instance): JsonResponse
    {
        $this->assertOwnership($request, $instance);

        try {
            Http::timeout(15)->post("{$this->baseUrl}/instance/desconnect", ['name' => $instance->name]);
            Http::timeout(15)->post("{$this->baseUrl}/instance/delete", ['name' => $instance->name]);
        } catch (\Throwable $e) {
            // segue e remove local mesmo assim
        }

        $instance->delete();

        return response()->json(['message' => 'Instância removida com sucesso.']);
    }

    private function assertOwnership(Request $request, Instance $instance): void
    {
        if ($instance->barbershop_id !== $request->user()->barbershop_id) {
            abort(404);
        }
    }
}
