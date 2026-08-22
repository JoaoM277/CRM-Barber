<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
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
}