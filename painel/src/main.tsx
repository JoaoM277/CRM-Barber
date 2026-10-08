import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ApiError, getToken } from "@/lib/api"
import App from "./App"
import "./index.css"

// acesso de suporte aberto pelo painel da plataforma: /painel/#suporte=<token>
// (guarda como sessão e tira o token da barra de endereço)
const suporte = location.hash.match(/^#suporte=(.+)$/)
if (suporte) {
  localStorage.setItem("admin_token", decodeURIComponent(suporte[1]))
  history.replaceState(null, "", location.pathname + location.search)
}

// sem sessão: vai para o login
if (!getToken()) {
  window.location.replace("/login.html")
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // erro de permissão/plano não melhora tentando de novo
      retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
      refetchOnWindowFocus: true,
    },
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <App />
          <Toaster richColors position="top-center" />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
