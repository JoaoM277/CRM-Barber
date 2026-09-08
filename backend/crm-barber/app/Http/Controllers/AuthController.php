<?php

namespace App\Http\Controllers;

use App\Models\Barbershop;
use App\Models\OperationTime;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Rotas web (routes/web.php): o front é estático e servido à parte,
     * então só redirecionamos para as páginas correspondentes.
     */
    public function showLogin()
    {
        return redirect()->away(rtrim(config('app.frontend_url'), '/').'/login.html');
    }

    public function showRegister()
    {
        return redirect()->away(rtrim(config('app.frontend_url'), '/').'/index.html');
    }

    /**
     * Cadastro de dono de barbearia.
     * Cria a barbearia + o usuário admin vinculado e devolve o token.
     */
    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:6',
            'barbershop_name' => 'required|string|max:255',
            'barbershop_phone' => 'nullable|string|max:20',
            'barbershop_whatsapp' => 'nullable|string|max:20',
        ]);

        $result = DB::transaction(function () use ($validated) {
            $barbershop = Barbershop::create([
                'name' => $validated['barbershop_name'],
                'slug' => $this->generateUniqueSlug($validated['barbershop_name']),
                'phone' => $validated['barbershop_phone'] ?? null,
                'whatsapp' => $validated['barbershop_whatsapp'] ?? null,
            ]);

            $user = User::create([
                'barbershop_id' => $barbershop->id,
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => $validated['password'],
                'role' => User::ROLE_ADMIN,
            ]);

            $this->seedDefaultOperationTimes($barbershop->id);

            return [$user, $barbershop];
        });

        [$user, $barbershop] = $result;

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user->load('barbershop'),
        ], 201);
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

    /**
     * Autenticação e emissão de token
     */

    public function Login(Request $request)
    {
        //1- Validação de campos
        $validate = $request ->validate([
            'email'=> 'required|email',
            'password'=> 'required',
        ]);

        //2 - Busca de usuario por email
        $user = User::where('email', $validate['email'])->first();

        //3 - Verificação de senha Hasheada
        if (!$user || !Hash::check($validate['password'], $user->password)){
            return response()->json([
                'message'=> 'Credenciais Invalidas'
            ], 401);
        }
        
        //3 - Criação de um novo token para a sessão da API
        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'access_token'=> $token,
            'token_type'=> 'Bearer',
            'user'=>$user,
        ]);
    }

    public function Me(Request $request)
    {
        return response()->json($request->user());
    }

    public function Logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message'=> 'Logout realizado com sucesso'
        ]);
    }
}