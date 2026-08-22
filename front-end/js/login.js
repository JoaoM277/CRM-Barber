const API_BASE_URL = 'http://127.0.0.1:8000/api';

const formLogin = document.getElementById("form-login");
const feedback = document.getElementById("login-feedback");

if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        const btnEntrar = document.getElementById("btn-entrar");

        btnEntrar.innerText = "Entrando...";
        btnEntrar.disabled = true;
        feedback.className = "login-toast";
        feedback.innerText = "";

        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok && data.access_token) {
                // Salva o token de acesso no navegador
                localStorage.setItem("admin_token", data.access_token);
                
                // Redireciona para o painel de administração que já construímos
                window.location.href = "admin.html"; // Ajuste o nome da sua página admin se for diferente
            } else {
                feedback.innerText = data.message || "E-mail ou senha inválidos.";
                feedback.classList.add("erro");
                btnEntrar.innerText = "Entrar no Painel";
                btnEntrar.disabled = false;
            }
        } catch (error) {
            feedback.innerText = "Erro de conexão com o servidor.";
            feedback.classList.add("erro");
            btnEntrar.innerText = "Entrar no Painel";
            btnEntrar.disabled = false;
        }
    });
}