import { BrowserRouter, Navigate, Route, Routes } from "react-router"
import { AppShell } from "@/components/app-shell"
import VisaoGeral from "@/pages/visao-geral"
import EmMigracao from "@/pages/em-migracao"

export default function App() {
  return (
    <BrowserRouter basename="/painel">
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<VisaoGeral />} />
          <Route path="agenda" element={<EmMigracao titulo="A agenda completa" />} />
          <Route path="clientes" element={<EmMigracao titulo="Clientes" />} />
          <Route path="servicos" element={<EmMigracao titulo="Serviços" />} />
          <Route path="profissionais" element={<EmMigracao titulo="Profissionais" />} />
          <Route path="financeiro" element={<EmMigracao titulo="O financeiro" />} />
          <Route path="whatsapp" element={<EmMigracao titulo="O WhatsApp" />} />
          <Route path="configuracoes" element={<EmMigracao titulo="Configurações" />} />
          <Route path="assinatura" element={<EmMigracao titulo="A assinatura" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
