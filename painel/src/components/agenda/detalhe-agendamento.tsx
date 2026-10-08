import { useEffect, useState } from "react"
import { Check, CheckCheck, MessageCircle, RotateCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { StatusAgendamentoBadge } from "@/components/status-agendamento"
import { useMudarStatus, useRemarcar } from "@/hooks/use-agenda"
import { useProfissionais } from "@/hooks/use-cadastros"
import { dataLonga, moeda } from "@/lib/format"
import type { Agendamento } from "@/lib/types"

/** Tudo sobre um agendamento: situação, remarcar (inclusive no celular) e observação. */
export function DetalheAgendamento({ agendamento: a, onFechar }: { agendamento: Agendamento | null; onFechar: () => void }) {
  const { data: profissionais = [] } = useProfissionais()
  const mudar = useMudarStatus()
  const remarcar = useRemarcar()

  const [data, setData] = useState("")
  const [horario, setHorario] = useState("")
  const [barbeiro, setBarbeiro] = useState("")
  const [obs, setObs] = useState("")

  useEffect(() => {
    if (!a) return
    setData(a.date.slice(0, 10))
    setHorario(a.start_time)
    setBarbeiro(a.worker ? String(a.worker.id) : "")
    setObs(a.observation ?? "")
  }, [a])

  if (!a) return <Sheet open={false} />

  const aberto = a.status === "pendente" || a.status === "confirmado"
  const mudouHorario = data !== a.date.slice(0, 10) || horario !== a.start_time || barbeiro !== String(a.worker?.id ?? "")
  const fone = a.cliente_telefone?.replace(/\D/g, "")

  const salvarRemarcacao = () =>
    remarcar.mutate(
      {
        id: a.id,
        ...(data !== a.date.slice(0, 10) ? { dataAgendamento: data } : {}),
        ...(horario !== a.start_time ? { horario } : {}),
        ...(barbeiro !== String(a.worker?.id ?? "") ? { barbeiroId: Number(barbeiro) } : {}),
      },
      { onSuccess: onFechar },
    )

  return (
    <Sheet open onOpenChange={(v) => !v && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-lg">{a.cliente_nome ?? "Cliente"}</SheetTitle>
          <SheetDescription className="first-letter:uppercase">
            {dataLonga(a.date)} · <span className="font-mono">{a.start_time}–{a.end_time}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-5 px-4 pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusAgendamentoBadge status={a.status} />
            {a.price != null && <span className="text-sm text-muted-foreground">{moeda(a.price)}</span>}
          </div>

          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Serviços</dt>
              <dd className="text-right">{a.servicos_nomes || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Profissional</dt>
              <dd>{a.worker?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Telefone</dt>
              <dd className="font-mono">{a.cliente_telefone ?? "—"}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            {fone && (
              <Button variant="outline" size="sm" asChild>
                <a href={`https://wa.me/${fone}`} target="_blank" rel="noopener">
                  <MessageCircle aria-hidden /> WhatsApp
                </a>
              </Button>
            )}
            {a.status === "pendente" && (
              <Button size="sm" onClick={() => mudar.mutate({ id: a.id, status: "confirmado" })}>
                <Check aria-hidden /> Confirmar
              </Button>
            )}
            {aberto && (
              <Button size="sm" variant="secondary" onClick={() => mudar.mutate({ id: a.id, status: "concluido" }, { onSuccess: onFechar })}>
                <CheckCheck aria-hidden /> Concluir atendimento
              </Button>
            )}
            {aberto && (
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => mudar.mutate({ id: a.id, status: "cancelado" }, { onSuccess: onFechar })}>
                <X aria-hidden /> Cancelar
              </Button>
            )}
            {!aberto && (
              <Button size="sm" variant="outline" onClick={() => mudar.mutate({ id: a.id, status: "pendente" })}>
                <RotateCcw aria-hidden /> Reabrir
              </Button>
            )}
          </div>

          {aberto && (
            <>
              <Separator />
              <div className="grid gap-3">
                <p className="font-medium">Remarcar</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="r-data">Dia</Label>
                    <Input id="r-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="r-hora">Horário</Label>
                    <Input id="r-hora" type="time" step={300} value={horario} onChange={(e) => setHorario(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Profissional</Label>
                  <Select value={barbeiro} onValueChange={setBarbeiro}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {profissionais.filter((p) => p.active || String(p.id) === barbeiro).map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={salvarRemarcacao} disabled={!mudouHorario || remarcar.isPending}>
                  {remarcar.isPending ? "Remarcando…" : "Salvar novo horário"}
                </Button>
              </div>
            </>
          )}

          <Separator />
          <div className="grid gap-2">
            <Label htmlFor="r-obs">Observação</Label>
            <Textarea id="r-obs" rows={3} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: prefere máquina 2 nas laterais" />
            <Button
              variant="outline"
              size="sm"
              className="justify-self-start"
              disabled={obs === (a.observation ?? "") || remarcar.isPending}
              onClick={() => remarcar.mutate({ id: a.id, observacoes: obs.trim() || null })}
            >
              Salvar observação
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
