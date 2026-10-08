# Plano: CRM-Barber → SaaS

Objetivo: transformar o CRM-Barber num SaaS que se vende sozinho — a barbearia
descobre, se cadastra, configura, paga e continua pagando sem intervenção manual.

Marque os itens com `[x]` conforme forem concluídos.

## Onde estamos (out/2026)

**Já existe (branch `backup-refactor-claude`, em produção na VPS Hostinger):**
multi-tenant, cadastro (`POST /cadastrar` + `TenantProvisioner`), agenda com
trava de concorrência, multi-serviço, comissões/repasses, WhatsApp via Evolution,
auditoria, backup MySQL, 38 testes.

**Falta para vender sozinho:**
- Cobrança: `barbershops.subscription_plan`/`subscription_ends_at` existem mas nada usa
- E-mail (`MAIL_MAILER=log`) e "esqueci minha senha"
- Landing page, onboarding guiado, painel super-admin
- Front vanilla (~5.6k linhas, `admin.js` com 1.3k) — difícil de profissionalizar e manter
- Link público `?b=slug` em vez de `suabarbearia.seudominio.com`

---

## Fase 0 — Fundação (~1 semana)

- [ ] `backup-refactor-claude` vira a `main`; branches abandonadas arquivadas
- [x] Remover skills do Prisma (`.agents`, `.claude`, `.windsurf`, `skills-lock.json`) do `messages-service`
- [x] CI no GitHub Actions (testes Laravel + Pint + checagem do Node)
- [x] Script de deploy (`deploy/deploy.sh`) — fim do deploy manual (1º deploy em prod: 07/10/2026)
- [x] Produção consolidada: 1 front (app.* cliente / barber.* painel, mesma pasta), 1 API, 1 banco, 1 Evolution; clones/sites órfãos removidos
- [x] Runbook de staging (`deploy/STAGING.md`)
- [ ] Staging de pé na VPS (subdomínio + banco próprio)
- [x] Backup off-site opcional via rclone (`scripts/backup-mysql.sh`)
- [ ] Backup off-site configurado na VPS (Backblaze B2 / S3)
- [ ] Sentry no Laravel e no Node (`composer require sentry/sentry-laravel` + DSN)
- [ ] UptimeRobot (ou similar) monitorando API, site público e `/health` do Node

## Fase 1 — Cobrança da assinatura (~2-3 semanas) ⭐

Gateway recomendado: **Asaas** (assinatura recorrente nativa com Pix/boleto/cartão,
webhooks, sandbox, emissão de NFS-e, subcontas para split na Fase 5).

- [x] Tabelas `plans` (preço, limites, features), `subscriptions` (`trialing`, `active`, `past_due`, `canceled`), `billing_events` (webhook idempotente)
- [x] Integração Asaas: cliente, assinatura, webhook com token
- [x] Trial de 14 dias sem cartão (no plano Premium)
- [x] Inadimplência: carência de ~7 dias → painel em modo leitura (site público **nunca** cai)
- [x] Feature gating por plano (limite de profissionais, WhatsApp, financeiro…)
- [x] Tela "Minha assinatura": plano atual, upgrade/downgrade, faturas, cartão, cancelar
- [x] Avisos no painel (fim do trial, atraso, modo leitura)
- [ ] Avisos de cobrança por e-mail/WhatsApp (depende do e-mail da Fase 2; o Asaas já notifica as cobranças)
- [x] Teste ponta a ponta no sandbox do Asaas + webhook (08/10/2026: assinar → cobrança → pagamento → ativa → cancelar, todos os webhooks processados)
- [ ] Validar preços (hoje: Básico R$ 49,90 · Pro R$ 99,90 · Premium R$ 179,90 — editáveis na tabela `plans`)

## Fase 2 — Aquisição e onboarding self-service (~2 semanas) ⭐

- [x] Landing page (`landing/index.html`): agenda de sábado se enchendo, recursos, como começar, preços e dias de teste vindos da API, FAQ — falta: apontar o DNS de usevellis.tech e publicar; depoimentos quando houver clientes reais
- [x] E-mails: esqueci minha senha, boas-vindas, fim do teste, fatura vencida — falta: conta no Resend + DNS do domínio de envio
- [ ] Verificação de e-mail no cadastro (adiado: cadastro sem atrito por enquanto)
- [x] Guia de primeiros passos no painel (serviços de exemplo, profissionais, horários, WhatsApp, link, 1º agendamento)
- [x] Página de cadastro self-service (`cadastro.html`)
- [ ] Subdomínio por barbearia (DNS wildcard + certificado wildcard)
- [x] Painel universal (`plataforma.html`): MRR, receita, conversão do trial, churn, cadastros/dia, situação das contas; barbearias com busca/filtro, conceder dias, trocar plano, suspender/reativar, acesso de suporte (2h, auditado); regras da assinatura, planos e webhooks do Asaas
- [x] Termos de Uso + Política de Privacidade (modelos) com aceite no cadastro — falta: revisão jurídica e preencher razão social/CNPJ/contatos

## Fase 3 — Layout profissional (~3-4 semanas, paralelo à Fase 2)

Recomendação: painel em **React + Vite + Tailwind + shadcn/ui** consumindo a API atual.

- [x] Design system (cores, tipografia, componentes) — identidade Vellis em `painel/src/index.css`
- [x] Painel novo (`painel/`, React + Vite + shadcn) com todos os módulos, padrão desde 08/10/2026 em /painel/
- [x] Agenda em calendário (dia/semana por profissional) com arrastar para remarcar
- [x] Empty states, skeletons, toasts, dark mode
- [ ] Remover o admin.html antigo depois de algumas semanas sem uso
- [x] Página pública de agendamento refeita (`agendamento/`, React leve, mobile-first, cores da barbearia) — no ar no link oficial desde 08/10/2026
- [ ] PWA (instalar na tela inicial) e remover a página antiga (`front-end/index.html` + `script.js`) depois de algumas semanas

## Fase 4 — Otimização e robustez (~1-2 semanas)

- [ ] Redis para cache e fila — adiado de propósito: com fila/cache no MySQL a carga atual é baixa; reavaliar perto de ~100 barbearias ativas ou se a fila atrasar
- [x] Página pública medida no Lighthouse (celular): desempenho 98, acessibilidade 100, boas práticas 96, SEO 100 — cache de rotas públicas desnecessário por ora
- [x] Upload de logo e fotos (re-codificadas em WebP, recortadas, sem EXIF) — CDN quando o volume justificar
- [x] LGPD do cliente final: baixar dados e apagar dados pessoais (anonimização) pela ficha do cliente
- [x] WhatsApp: limite de 20 mensagens/min por barbearia (excesso é adiado, não perdido) + aviso de risco na tela de conexão
- [ ] Estudar Meta Cloud API (WhatsApp oficial) como opção do plano Premium

## Fase 5 — Novas funcionalidades (contínuo, por valor de venda)

| Prioridade | Funcionalidade | Por que vende |
|---|---|---|
| 1 | ✅ Lembrete automático (24h/2h antes) com confirmação por resposta — no ar em 08/10/2026 | Reduz no-show |
| 2 | ✅ Cliente cancela/remarca pelo link (antecedência configurável) — no ar em 08/10/2026 | Menos trabalho pro dono |
| 3 | Sinal/pagamento antecipado via Pix (subconta Asaas) | Mata o no-show; possível receita (take rate) |
| 4 | Clube de assinatura (cliente paga mensal) | Muito forte em barbearia hoje |
| 5 | Reativação de clientes sumidos (X dias sem visita → WhatsApp) | Receita visível pro dono |
| 6 | Relatórios (ticket médio, taxa de retorno, ocupação) | Justifica plano Pro |
| 7 | Comanda / produtos / estoque | Captura venda de balcão |
| 8 | Fidelidade/cashback, lista de espera, avaliação pós-atendimento | Diferenciais |
| 9 | Multi-unidade | Plano Premium |

## Fase 6 — Lançamento

- [ ] Beta fechado com 3-5 barbearias reais (desconto em troca de feedback/depoimento)
- [ ] Métricas: ativação (1º agendamento), conversão trial→pago, churn, MRR
- [ ] Suporte: WhatsApp + base de ajuda + vídeos curtos de onboarding
- [ ] Programa de indicação (1 mês grátis por indicação)

---

## Sequência

**0 → 1 + 2 → 3 (paralelo à 2) → 4 → Beta → 5 contínuo.**
Estimativa grosseira para "vendável" (Fases 0–4): ~10-12 semanas.

## Decisões em aberto

1. ~~Gateway~~ → **Asaas** (decidido em 07/10/2026)
2. Front: migrar para React + Vite + shadcn, ou manter vanilla e só redesenhar?
3. Planos e preço (sugestão: Básico / Pro / Premium, escalando por nº de profissionais) — pesquisar Trinks, AppBarber, Booksy, BestBarbers, Avec
4. Nome da marca e domínio da landing page
5. CNPJ (necessário para o gateway)

## Riscos

- **WhatsApp via Evolution** (API não oficial): risco de ban do número
- **VPS única**: ponto único de falha — backup off-site e runbook de restore são obrigatórios
- **LGPD**: dados pessoais de clientes finais de várias barbearias
- **Fiscal**: emissão de NFS-e da receita do SaaS
