import { BrowserRouter, Navigate, Route, Routes } from "react-router"
import { AppShell } from "@/components/app-shell"
import Agenda from "@/pages/agenda"
import AssinaturaPage from "@/pages/assinatura"
import Clientes from "@/pages/clientes"
import Configuracoes from "@/pages/configuracoes"
import Financeiro from "@/pages/financeiro"
import Profissionais from "@/pages/profissionais"
import Relatorios from "@/pages/relatorios"
import Servicos from "@/pages/servicos"
import VisaoGeral from "@/pages/visao-geral"
import WhatsApp from "@/pages/whatsapp"
import { useMe } from "@/hooks/use-sessao"

/** Telas de administrador (financeiro, WhatsApp, configurações, assinatura). */
function SoAdmin({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useMe()
  if (isLoading) return null
  return me?.role === "admin" ? children : <Navigate to="/" replace />
}

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
          <Route path="financeiro" element={<SoAdmin><Financeiro /></SoAdmin>} />
          <Route path="relatorios" element={<SoAdmin><Relatorios /></SoAdmin>} />
          <Route path="whatsapp" element={<SoAdmin><WhatsApp /></SoAdmin>} />
          <Route path="configuracoes" element={<SoAdmin><Configuracoes /></SoAdmin>} />
          <Route path="assinatura" element={<SoAdmin><AssinaturaPage /></SoAdmin>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
