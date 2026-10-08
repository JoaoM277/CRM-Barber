# Página de agendamento (cliente final)

O link que a barbearia divulga (`https://app.usevellis.tech/?b=<slug>`).
React + Vite + Tailwind, sem biblioteca de componentes — tem que abrir rápido no 4G.
Veste a cor da barbearia (configurada no painel); a Vellis aparece só no rodapé.

```bash
npm install
VITE_API_URL=http://localhost:8000/api npm run dev   # abra /agendar/?b=<slug>
npm run build                                        # gera ../front-end/agendar (fora do git)
```

- O nginx serve `/` e `/index.html` (com `?b=`) a partir de `/agendar/`, então
  os links antigos continuam funcionando.
- Horários livres: `src/lib/horarios.ts` (expediente + almoço + ocupados + duração);
  o servidor revalida tudo ao agendar.
