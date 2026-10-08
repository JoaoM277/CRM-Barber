import { NavLink, Outlet, useLocation } from "react-router"
import { useTheme } from "next-themes"
import {
  CalendarDays,
  ChartColumn,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Moon,
  Scissors,
  Settings,
  Sun,
  TrendingUp,
  Users,
  UserRound,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { AvisoAssinatura, FaixaSuporte } from "@/components/banners"
import { useBarbearia, useMe } from "@/hooks/use-sessao"
import { api, sair } from "@/lib/api"

type Item = { to: string; titulo: string; icone: typeof Users; soAdmin?: boolean }

export const NAVEGACAO: Item[] = [
  { to: "/", titulo: "Visão geral", icone: LayoutDashboard },
  { to: "/agenda", titulo: "Agenda", icone: CalendarDays },
  { to: "/clientes", titulo: "Clientes", icone: Users },
  { to: "/servicos", titulo: "Serviços", icone: Scissors },
  { to: "/profissionais", titulo: "Profissionais", icone: UserRound },
  { to: "/financeiro", titulo: "Financeiro", icone: ChartColumn, soAdmin: true },
  { to: "/relatorios", titulo: "Relatórios", icone: TrendingUp, soAdmin: true },
  { to: "/whatsapp", titulo: "WhatsApp", icone: MessageCircle, soAdmin: true },
  { to: "/configuracoes", titulo: "Configurações", icone: Settings, soAdmin: true },
  { to: "/assinatura", titulo: "Assinatura", icone: CreditCard, soAdmin: true },
]

const ativo = (to: string, pathname: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to))

function Menu() {
  const { data: me } = useMe()
  const { setOpenMobile } = useSidebar()
  const { pathname } = useLocation()
  const itens = NAVEGACAO.filter((i) => !i.soAdmin || me?.role === "admin")

  return (
    <SidebarMenu>
      {itens.map((i) => (
        <SidebarMenuItem key={i.to}>
          <SidebarMenuButton asChild isActive={ativo(i.to, pathname)} tooltip={i.titulo} className="h-10 text-[15px]">
            <NavLink to={i.to} end={i.to === "/"} onClick={() => setOpenMobile(false)}>
              <i.icone aria-hidden />
              <span>{i.titulo}</span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

function Rodape() {
  const { data: me } = useMe()
  const { resolvedTheme, setTheme } = useTheme()
  const escuro = resolvedTheme === "dark"

  const encerrar = async () => {
    await api("/logout", { method: "POST" }).catch(() => {})
    sair()
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={() => setTheme(escuro ? "light" : "dark")} tooltip="Trocar tema">
          {escuro ? <Sun aria-hidden /> : <Moon aria-hidden />}
          <span>{escuro ? "Tema claro" : "Tema escuro"}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={encerrar} tooltip="Sair">
          <LogOut aria-hidden />
          <span className="truncate">Sair{me ? ` · ${me.name.split(" ")[0]}` : ""}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function AppShell() {
  const { data: barbearia } = useBarbearia()
  const { pathname } = useLocation()
  const atual = NAVEGACAO.find((i) => ativo(i.to, pathname))

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="px-3 pt-4 pb-2">
          <div className="flex items-center gap-3 overflow-hidden">
            {barbearia?.logo_url ? (
              <img src={barbearia.logo_url} alt="" className="size-9 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-sidebar-primary font-display text-xl font-extrabold text-sidebar-primary-foreground">
                {(barbearia?.name ?? "V").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate font-semibold leading-tight">{barbearia?.name ?? "Carregando…"}</p>
              <p className="font-display text-sm tracking-[0.16em] text-sidebar-foreground/60 uppercase">Vellis</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <Menu />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <Rodape />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <FaixaSuporte />
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-6">
          <SidebarTrigger aria-label="Abrir ou fechar o menu" />
          <Separator orientation="vertical" className="h-5" />
          <h1 className="font-display text-2xl font-extrabold tracking-wide uppercase">{atual?.titulo ?? "Vellis"}</h1>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8">
          <AvisoAssinatura />
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
