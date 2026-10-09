// ==========================================================================
//  Cadastro, esqueci minha senha e redefinir senha.
//  Cada página tem o seu formulário; este arquivo liga o que existir nela.
// ==========================================================================
const API = window.API_BASE_URL || "http://localhost:8000/api";
const feedback = document.getElementById("auth-feedback");

function avisar(msg, tipo = "erro") {
  feedback.textContent = msg;
  feedback.className = `login-toast ${tipo}`;
}

async function enviar(path, corpo) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(corpo),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.errors ? Object.values(data.errors).flat()[0] : data.message;
    throw new Error(res.status === 429 ? "Muitas tentativas. Aguarde um minuto e tente de novo." : (msg || "Não foi possível concluir."));
  }
  return data;
}

async function comBotao(btn, textoOcupado, fn) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = textoOcupado;
  try {
    await fn();
  } catch (e) {
    avisar(e.message === "Failed to fetch" ? "Erro de conexão com o servidor." : e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

// ---------------------------------------------------------------- cadastro
const formCadastro = document.getElementById("form-cadastro");
if (formCadastro) {
  formCadastro.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = (id) => document.getElementById(id).value.trim();

    if (!v("cad-nome") || !v("cad-barbearia") || !v("cad-email") || !v("cad-senha")) {
      return avisar("Preencha nome, barbearia, e-mail e senha.");
    }
    if (v("cad-senha").length < 6) return avisar("A senha precisa ter pelo menos 6 caracteres.");
    if (!document.getElementById("cad-termos").checked) {
      return avisar("É preciso aceitar os Termos de Uso e a Política de Privacidade.");
    }

    comBotao(document.getElementById("btn-cadastrar"), "Criando sua conta…", async () => {
      const data = await enviar("/cadastrar", {
        name: v("cad-nome"),
        barbershop_name: v("cad-barbearia"),
        barbershop_whatsapp: v("cad-whatsapp") || null,
        modelo_equipe: document.querySelector('input[name="modelo_equipe"]:checked')?.value || "equipe",
        email: v("cad-email"),
        password: v("cad-senha"),
        aceite_termos: true,
      });
      localStorage.setItem("admin_token", data.access_token);
      // o painel abre o guia de primeiros passos
      window.location.href = "/painel/?bem-vindo=1";
    });
  });
}

// ---------------------------------------------------------------- esqueci minha senha
const formEsqueci = document.getElementById("form-esqueci");
if (formEsqueci) {
  formEsqueci.addEventListener("submit", (e) => {
    e.preventDefault();
    comBotao(document.getElementById("btn-esqueci"), "Enviando…", async () => {
      const data = await enviar("/senha/esqueci", { email: document.getElementById("esq-email").value.trim() });
      avisar(`${data.message} Confira também a caixa de spam.`, "ok");
      formEsqueci.reset();
    });
  });
}

// ---------------------------------------------------------------- redefinir senha
const formRedefinir = document.getElementById("form-redefinir");
if (formRedefinir) {
  const params = new URLSearchParams(location.search);
  const token = params.get("token");
  const email = params.get("email");

  if (!token || !email) {
    formRedefinir.style.display = "none";
    avisar("Link incompleto. Peça um novo em \"Esqueci minha senha\".");
  } else {
    document.getElementById("red-email").textContent = `Conta: ${email}`;
  }

  formRedefinir.addEventListener("submit", (e) => {
    e.preventDefault();
    const senha = document.getElementById("red-senha").value;
    if (senha.length < 6) return avisar("A senha precisa ter pelo menos 6 caracteres.");
    if (senha !== document.getElementById("red-confirma").value) return avisar("As senhas não conferem.");

    comBotao(document.getElementById("btn-redefinir"), "Salvando…", async () => {
      const data = await enviar("/senha/redefinir", {
        email, token, password: senha, password_confirmation: senha,
      });
      formRedefinir.style.display = "none";
      // tira o token da barra de endereço
      history.replaceState(null, "", location.pathname);
      avisar(data.message, "ok");
    });
  });
}

// dias de teste e cadastro aberto/fechado vêm da configuração da plataforma
const subCadastro = document.getElementById("cad-sub");
if (subCadastro) {
  fetch(`${API}/publico/config`, { headers: { Accept: "application/json" } })
    .then((r) => r.json())
    .then((c) => {
      // só fecha quando a API diz explicitamente que está fechado (falha na consulta não bloqueia o cadastro)
      if (c.cadastro_aberto === false) {
        formCadastro.style.display = "none";
        avisar("Novos cadastros estão temporariamente fechados. Volte em breve!");
        return;
      }
      if (typeof c.dias_teste !== "number") return;
      subCadastro.textContent = c.dias_teste > 0
        ? `Teste todos os recursos por ${c.dias_teste} dias. Sem cartão de crédito.`
        : "Crie sua conta e escolha um plano.";
    })
    .catch(() => {});
}
