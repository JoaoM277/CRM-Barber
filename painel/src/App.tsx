import { BrowserRouter, Navigate, Route, Routes } from "react-router"
import { AppShell } from "@/components/app-shell"
import VisaoGeral from "@/pages/visao-geral"
import EmMigracao from "@/pages/em-migracao"
import Agenda from "@/pages/agenda"
import Clientes from "@/pages/clientes"
import Financeiro from "@/pages/financeiro"
import Profissionais from "@/pages/profissionais"
import Servicos from "@/pages/servicos"

export default function App() {
  return (
    <BrowserRouter basename="/painel">
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<VisaoGeral />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="servicos" element={<Servicos />} />
          <Route path="profissionais" element={<Profissionais />} />
          <Route path="financeiro" element={<Financeiro />} />
          <Route path="whatsapp" element={<EmMigracao titulo="O WhatsApp" />} />
          <Route path="configuracoes" element={<EmMigracao titulo="Configurações" />} />
          <Route path="assinatura" element={<EmMigracao titulo="A assinatura" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
