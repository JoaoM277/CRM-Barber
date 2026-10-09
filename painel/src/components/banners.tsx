import { Link, useLocation } from "react-router"
import { ClipboardList, LifeBuoy, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useResumoPendencias } from "@/hooks/use-pendencias"
import { useMe } from "@/hooks/use-sessao"
import { api, sair } from "@/lib/api"
import { dataBR, diasAte } from "@/lib/format"

const diaCurto = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number)
  const dt = new Date(a, m - 1, d)
  return `${dt.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`
}

/**
 * Atendimentos esquecidos: dias anteriores sem registro (acumulam) e faltas
 * automáticas que ainda dá para corrigir. Some quando tudo está registrado.
 */
export function AvisoPendencias() {
  const { data: r } = useResumoPendencias()
  const { pathname } = useLocation()
  if (!r || pathname.startsWith("/pendencias") || (!r.nao_registrados && !r.faltas_para_revisar)) return null

  const partes: string[] = []
  if (r.nao_registrados === 1 && r.por_dia[0]) {
    const d = new Date(`${r.por_dia[0].data}T12:00`)
    partes.push(`Atendimento de ${d.toLocaleDateString("pt-BR", { weekday: "long" })} (${dataBR(r.por_dia[0].data)}) não registrado`)
  } else if (r.nao_registrados > 1) {
    const dias = r.por_dia.map((d) => `${diaCurto(d.data)} (${d.total})`).join(", ")
    partes.push(`${r.nao_registrados} atendimentos sem registro: ${dias}${r.dias > r.por_dia.length ? "…" : ""}`)
  }
  if (r.faltas_para_revisar) {
    partes.push(`${r.faltas_para_revisar} falta${r.faltas_para_revisar > 1 ? "s" : ""} automática${r.faltas_para_revisar > 1 ? "s" : ""} para revisar`)
  }

  return (
    <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
      <span className="inline-flex items-start gap-2">
        <ClipboardList className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{partes.join(" · ")}</span>
      </span>
      <Button size="sm" variant="outline" asChild>
        <Link to="/pendencias">Registrar agora</Link>
      </Button>
    </div>
  )
}

/** Faixa do acesso de suporte (aberto pelo painel da plataforma). */
export function FaixaSuporte() {
  const { data: me } = useMe()
  if (!me?.suporte) return null

  const encerrar = async () => {
    await api("/logout", { method: "POST" }).catch(() => {})
    sair()
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-[#1d3a5f] px-4 py-2 text-center text-sm text-[#dbe9ff]">
      <span className="inline-flex items-center gap-2">
        <LifeBuoy className="size-4" aria-hidden />
        Modo suporte: senha, assinatura e usuários ficam bloqueados.
      </span>
      <button onClick={encerrar} className="rounded-md border border-current px-2 py-0.5 text-xs hover:bg-white/10">
        Encerrar acesso
      </button>
    </div>
  )
}

/** Aviso de teste acabando, fatura em atraso, modo leitura ou assinatura cancelada. */
export function AvisoAssinatura() {
  const { data: me } = useMe()
  const { pathname } = useLocation()
  const a = me?.assinatura
  if (!a) return null

  const dias = diasAte(a.acesso_ate)
  let texto = ""
  let grave = false

  if (a.acesso === "read_only") {
    grave = true
    texto = "Sua assinatura não está ativa. O painel está em modo leitura."
  } else if (a.em_carencia) {
    texto = `Há uma mensalidade em atraso. Regularize em até ${dias} dia(s) para não perder o acesso.`
  } else if (a.status === "trialing" && !a.tem_assinatura_no_gateway && dias !== null && dias <= 7) {
    texto = `Seu teste grátis termina em ${dias} dia(s). Escolha um plano para continuar.`
  } else if (a.status === "canceled") {
    texto = `Assinatura cancelada. O acesso vai até ${dataBR(a.acesso_ate)}.`
  }
  if (!texto) return null

  return (
    <div
      role="status"
      className={
        "mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm " +
        (grave
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-warning/40 bg-warning/10 text-warning")
      }
    >
      <span className="inline-flex items-center gap-2 font-medium">
        <TriangleAlert className="size-4 shrink-0" aria-hidden />
        {texto}
      </span>
      {me?.role === "admin" && pathname !== "/assinatura" && (
        <Button asChild size="sm" variant="outline">
          <Link to="/assinatura">Ver assinatura</Link>
        </Button>
      )}
    </div>
  )
}
