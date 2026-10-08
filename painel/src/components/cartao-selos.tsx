import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Gift } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { Fidelidade } from "@/lib/types"

/** Selos do cartão fidelidade (bolinhas) e o resgate do prêmio no balcão. */
export function CartaoSelos({ f, clienteId, agendamentoId, className }: { f: Fidelidade; clienteId: number; agendamentoId?: number; className?: string }) {
  const qc = useQueryClient()
  // a tela que abriu o cartão pode estar com dados antigos: some o botão na hora
  const [entregue, setEntregue] = useState(false)
  const resgatar = useMutation({
    mutationFn: () => api<{ message: string }>(`/clientes/${clienteId}/fidelidade/resgatar`, { method: "POST", body: { agendamento_id: agendamentoId ?? null } }),
    onSuccess: (r) => {
      setEntregue(true)
      ;["clientes", "agendamentos", "fidelidade"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
      toast.success(r.message)
    },
    onError: (e) => toast.error(e.message),
  })

  const cheios = Math.min(f.selos, f.meta)

  return (
    <div className={cn("grid gap-2 rounded-lg border p-3", f.premio_disponivel && "border-primary/40 bg-primary/5", className)}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">Cartão fidelidade</span>
        <span className="tabular text-muted-foreground">{f.selos} de {f.meta}</span>
      </div>
      <div className="flex flex-wrap gap-1" role="img" aria-label={`${cheios} de ${f.meta} selos`}>
        {Array.from({ length: f.meta }, (_, i) => (
          <span key={i} className={cn("size-3.5 rounded-full border", i < cheios ? "border-primary bg-primary" : "border-border")} />
        ))}
      </div>
      {entregue ? (
        <p className="text-sm font-medium text-success">Prêmio entregue. O cartão recomeça.</p>
      ) : f.premio_disponivel ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            <Gift className="size-4" aria-hidden /> Prêmio liberado: {f.premio}
          </p>
          <Button size="sm" onClick={() => resgatar.mutate()} disabled={resgatar.isPending}>Entregar prêmio</Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Faltam {f.meta - f.selos} para ganhar: {f.premio}</p>
      )}
    </div>
  )
}
