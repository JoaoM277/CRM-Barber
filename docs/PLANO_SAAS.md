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
- [x] Script de deploy (`deploy/deploy.sh`) — fim do deploy manual
- [x] Runbook de staging (`deploy/STAGING.md`)
- [ ] Staging de pé na VPS (subdomínio + banco próprio)
- [x] Backup off-site opcional via rclone (`scripts/backup-mysql.sh`)
- [ ] Backup off-site configurado na VPS (Backblaze B2 / S3)
- [ ] Sentry no Laravel e no Node (`composer require sentry/sentry-laravel` + DSN)
- [ ] UptimeRobot (ou similar) monitorando API, site público e `/health` do Node

## Fase 1 — Cobrança da assinatura (~2-3 semanas) ⭐

Gateway recomendado: **Asaas** (assinatura recorrente nativa com Pix/boleto/cartão,
webhooks, sandbox, emissão de NFS-e, subcontas para split na Fase 5).

- [ ] Tabelas `plans` (preço, limites, features), `subscriptions` (`trialing`, `active`, `past_due`, `canceled`), `billing_events` (webhook idempotente)
- [ ] Integração Asaas: cliente, assinatura, webhook assinado
- [ ] Trial de 14 dias sem cartão
- [ ] Inadimplência: carência de ~7 dias → painel em modo leitura (site público **nunca** cai)
- [ ] Feature gating por plano (limite de profissionais, WhatsApp, financeiro…)
- [ ] Tela "Minha assinatura": plano atual, upgrade/downgrade, faturas, cartão, cancelar
- [ ] Avisos de cobrança (fim do trial, falha de pagamento, renovação)

## Fase 2 — Aquisição e onboarding self-service (~2 semanas) ⭐

- [ ] Landing page: proposta de valor, prints/vídeo, preços, FAQ, depoimentos, CTA "Teste grátis"
- [ ] E-mail transacional (Resend ou SES): verificação de e-mail, **esqueci minha senha**, boas-vindas
- [ ] Wizard pós-cadastro: dados/logo → serviços (templates) → profissionais → horários → WhatsApp → "seu link está pronto"
- [ ] Subdomínio por barbearia (DNS wildcard + certificado wildcard)
- [ ] Painel super-admin: barbearias, status de assinatura, MRR, churn, trials, impersonate, bloquear/desbloquear
- [ ] Termos de Uso + Política de Privacidade (LGPD), aceite no cadastro

## Fase 3 — Layout profissional (~3-4 semanas, paralelo à Fase 2)

Recomendação: painel em **React + Vite + Tailwind + shadcn/ui** consumindo a API atual.

- [ ] Design system (cores, tipografia, componentes)
- [ ] Painel migrado módulo a módulo: Agenda → Clientes → Serviços/Profissionais → Financeiro → Configurações
- [ ] Agenda em calendário (dia/semana por profissional) com arrastar para remarcar
- [ ] Empty states, skeletons, toasts, dark mode
- [ ] Página pública de agendamento refeita (leve, mobile-first, PWA)

## Fase 4 — Otimização e robustez (~1-2 semanas)

- [ ] Redis para cache e fila
- [ ] Cache das rotas públicas, revisão de N+1, Lighthouse > 90 na página pública
- [ ] Upload de imagens (logo, foto do profissional) com resize + storage/CDN
- [ ] LGPD do cliente final: exportar/apagar dados
- [ ] WhatsApp: rate limit de envio, avisos de risco de ban; estudar Meta Cloud API como opção premium

## Fase 5 — Novas funcionalidades (contínuo, por valor de venda)

| Prioridade | Funcionalidade | Por que vende |
|---|---|---|
| 1 | Lembrete automático (24h/2h antes) com confirmação por resposta | Reduz no-show |
| 2 | Cliente cancela/remarca pelo link | Menos trabalho pro dono |
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
