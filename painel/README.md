# Painel Vellis (React)

Painel da barbearia em React + Vite + TypeScript + Tailwind + shadcn/ui.
Substitui aos poucos o `front-end/admin.html`; os dois usam a mesma sessão
(`localStorage.admin_token`) e a mesma configuração (`/js/env.js`).

```bash
npm install
VITE_API_URL=http://localhost:8000/api npm run dev   # abre em /painel/
npm run build                                        # gera ../front-end/painel (fora do git)
```

- Publicado em `https://barber.usevellis.tech/painel/` — o `deploy/deploy.sh`
  roda `npm ci && npm run build` no servidor quando `painel/` muda.
- Identidade visual (cores e fontes) em `src/index.css`; componentes do
  shadcn em `src/components/ui` (adicionar com `npx shadcn@latest add <nome>`).
