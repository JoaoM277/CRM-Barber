<?php

namespace App\Http\Controllers;

use App\Models\Subscription;
use App\Models\User;
use App\Notifications\WelcomeNotification;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Facades\Password;
use App\Support\Audit;
use App\Support\PlatformSettings;
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
        if (! PlatformSettings::get('signup_open')) {
            return response()->json([
                'code' => 'signup_closed',
                'message' => 'Novos cadastros estão temporariamente fechados.',
            ], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:6',
            'barbershop_name' => 'required|string|max:255',
            'barbershop_phone' => 'nullable|string|max:20',
            'barbershop_whatsapp' => 'nullable|string|max:20',
            'aceite_termos' => 'accepted',
        ], [
            'aceite_termos.accepted' => 'É preciso aceitar os Termos de Uso e a Política de Privacidade.',
            'email.unique' => 'Já existe uma conta com este e-mail. Entre ou recupere a senha.',
        ]);

        [$user, $barbershop] = $provisioner->create($validated);
        $user->forceFill(['terms_accepted_at' => now()])->save();

        // e-mail na fila: falha no envio não pode derrubar o cadastro
        rescue(fn () => $user->notify(new WelcomeNotification($barbershop, PlatformSettings::trialDays())));

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
        // admin da plataforma vê todas as barbearias: sessão curta
        $expiresAt = $user->isSuperAdmin() ? now()->addHours(12) : null;
        $token = $user->createToken('auth-token', ['*'], $expiresAt)->plainTextToken;

        return response()->json([
            'access_token'=> $token,
            'token_type'=> 'Bearer',
            'user'=>$user,
        ]);
    }

    public function Me(Request $request)
    {
        $user = $request->user();
        $sub = Subscription::with('plan')->where('barbershop_id', $user->barbershop_id)->first();

        // mesmos campos de sempre + a situação da assinatura (aviso de trial/atraso no painel)
        return response()->json($user->toArray() + [
            'assinatura' => $sub?->toPanelArray(),
            'suporte' => $user->isSupportSession(),
        ]);
    }

    public function Logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message'=> 'Logout realizado com sucesso'
        ]);
    }

    /**
     * Troca a senha do próprio usuário logado. Exige a senha atual pra
     * confirmar (não é o mesmo fluxo de UserController@update, que é o
     * admin editando qualquer usuário da barbearia sem precisar da senha antiga).
     */
    public function updatePassword(Request $request)
    {
        $validated = $request->validate([
            'senha_atual' => 'required|string',
            'nova_senha' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $user = $request->user();

        if (! Hash::check($validated['senha_atual'], $user->password)) {
            return response()->json(['message' => 'Senha atual incorreta.'], 422);
        }

        $user->password = $validated['nova_senha'];
        $user->save();

        Audit::log('senha.alterada', $user, 'Senha do usuário alterada');

        return response()->json(['message' => 'Senha atualizada com sucesso!']);
    }

    /**
     * POST /senha/esqueci — manda o link de redefinição. A resposta é sempre a
     * mesma, exista ou não a conta (não revela quais e-mails estão cadastrados).
     */
    public function forgotPassword(Request $request)
    {
        $data = $request->validate(['email' => 'required|email']);

        rescue(fn () => Password::sendResetLink(['email' => strtolower(trim($data['email']))]));

        return response()->json([
            'message' => 'Se houver uma conta com este e-mail, enviamos um link para criar uma nova senha.',
        ]);
    }

    /** POST /senha/redefinir — troca a senha com o token do e-mail e derruba as sessões abertas. */
    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'token' => 'required|string',
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $status = Password::reset(
            ['email' => strtolower(trim($data['email'])), 'token' => $data['token'], 'password' => $data['password']],
            function (User $user, string $password) {
                $user->forceFill(['password' => $password])->save();
                $user->tokens()->delete();
                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json([
                'message' => 'O link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".',
            ], 422);
        }

        return response()->json(['message' => 'Senha alterada! Entre com a nova senha.']);
    }
}