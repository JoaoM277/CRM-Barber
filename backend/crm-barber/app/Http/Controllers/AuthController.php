<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\TenantProvisioner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
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
    public function register(Request $request, TenantProvisioner $provisioner)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:6',
            'barbershop_name' => 'required|string|max:255',
            'barbershop_phone' => 'nullable|string|max:20',
            'barbershop_whatsapp' => 'nullable|string|max:20',
        ]);

        [$user, $barbershop] = $provisioner->create($validated);

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user->load('barbershop'),
        ], 201);
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