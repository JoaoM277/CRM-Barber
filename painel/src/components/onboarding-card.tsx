import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { Check, Copy, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { api } from "@/lib/api"
import { linkAgendamento } from "@/lib/format"
import type { Onboarding, PassoOnboarding } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Guia de primeiros passos: leva a barbearia ao primeiro agendamento. */
export function OnboardingCard({ boasVindas }: { boasVindas?: boolean }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data } = useQuery({ queryKey: ["onboarding"], queryFn: () => api<Onboarding>("/onboarding") })

  const marcar = useMutation({
    mutationFn: (passo: "horarios" | "link" | "dispensar") =>
      api<Onboarding>("/onboarding/marcar", { method: "POST", body: { passo } }),
    onSuccess: (d) => qc.setQueryData(["onboarding"], d),
  })

  const exemplos = useMutation({
    mutationFn: () => api<{ message: string }>("/onboarding/servicos-padrao", { method: "POST" }),
    onSuccess: (r) => {
      toast.success(r.message)
      qc.invalidateQueries({ queryKey: ["onboarding"] })
      qc.invalidateQueries({ queryKey: ["servicos"] })
    },
    onError: (e) => toast.error(e.message),
  })

  if (!data || data.concluido || data.dispensado) return null

  const link = linkAgendamento(data.slug)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast.success("Link copiado! Cole na bio do Instagram e no WhatsApp.")
    } catch {
      toast.message(link)
    }
    marcar.mutate("link")
  }

  const acoes = (p: PassoOnboarding) => {
    switch (p.id) {
      case "servicos":
        return (
          <>
            <Button size="sm" onClick={() => exemplos.mutate()} disabled={exemplos.isPending}>
              Usar serviços de exemplo
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/servicos")}>
              Cadastrar os meus
            </Button>
          </>
        )
      case "profissionais":
        return (
          <Button size="sm" onClick={() => navigate("/profissionais?novo=1")}>
            Cadastrar profissional
          </Button>
        )
      case "horarios":
        return (
          <>
            <Button size="sm" variant="outline" onClick={() => navigate("/configuracoes#horarios")}>
              Ver horários
            </Button>
            <Button size="sm" onClick={() => marcar.mutate("horarios")}>
              Já conferi
            </Button>
          </>
        )
      case "whatsapp":
        return (
          <Button size="sm" onClick={() => navigate("/whatsapp")}>
            Conectar WhatsApp
          </Button>
        )
      case "link":
        return (
          <div className="flex w-full flex-wrap gap-2">
            <Input readOnly value={link} aria-label="Seu link de agendamento" className="min-w-0 flex-1 basis-56" onFocus={(e) => e.target.select()} />
            <Button size="sm" onClick={copiar} className="h-9">
              <Copy aria-hidden /> Copiar link
            </Button>
          </div>
        )
      case "agendamento":
        return (
          <Button size="sm" variant="outline" asChild>
            <a href={link} target="_blank" rel="noopener">
              <ExternalLink aria-hidden /> Abrir minha página de agendamento
            </a>
          </Button>
        )
    }
  }

  const pct = Math.round((data.feitos / data.total) * 100)

  return (
    <Card className="mb-8">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg">{boasVindas ? "Bem-vindo(a)! Sua barbearia está no ar" : "Primeiros passos"}</CardTitle>
          <CardDescription>
            {data.feitos} de {data.total} concluídos — falta pouco para o primeiro agendamento.
          </CardDescription>
        </div>
        <Button variant="link" size="sm" className="text-muted-foreground" onClick={() => marcar.mutate("dispensar")}>
          Ocultar guia
        </Button>
      </CardHeader>
      <CardContent>
        <Progress value={pct} aria-label={`${pct}% concluído`} className="mb-2" />
        <ol>
          {data.passos.map((p) => (
            <li key={p.id} className="flex gap-4 border-t py-4 first:border-t-0">
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2",
                  p.feito ? "border-success bg-success text-success-foreground" : "border-border",
                )}
              >
                {p.feito && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("font-medium", p.feito && "text-muted-foreground line-through")}>
                  {p.titulo}
                  <span className="sr-only">{p.feito ? " (feito)" : " (pendente)"}</span>
                </p>
                {!p.feito && (
                  <>
                    <p className="text-sm text-muted-foreground">{p.descricao}</p>
                    <div className="mt-3 flex flex-wrap gap-2">{acoes(p)}</div>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
