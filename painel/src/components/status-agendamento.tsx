import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { StatusAgendamento } from "@/lib/types"

const ROTULO: Record<StatusAgendamento, string> = {
  pendente: "A confirmar",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
}

const ESTILO: Record<StatusAgendamento, string> = {
  pendente: "border-warning/50 bg-warning/10 text-warning",
  confirmado: "border-success/50 bg-success/10 text-success",
  concluido: "border-border bg-muted text-muted-foreground",
  cancelado: "border-destructive/40 bg-destructive/10 text-destructive line-through",
}

/** Situação do agendamento: sempre texto + cor (nunca só cor). */
export function StatusAgendamentoBadge({ status, className }: { status: StatusAgendamento; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", ESTILO[status], className)}>
      {ROTULO[status]}
    </Badge>
  )
}
