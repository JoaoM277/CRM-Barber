import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useNovoAgendamento } from "@/hooks/use-agenda"
import { useProfissionais, useServicos } from "@/hooks/use-cadastros"
import { ApiError } from "@/lib/api"
import { moeda } from "@/lib/format"

export type Preenchimento = { data: string; horario?: string; barbeiroId?: number }

/** Marcar um horário pelo painel (cliente que liga ou chega no balcão). */
export function NovoAgendamento({ aberto, onFechar, inicial }: { aberto: boolean; onFechar: () => void; inicial: Preenchimento }) {
  const { data: profissionais = [] } = useProfissionais()
  const { data: servicos = [] } = useServicos()
  const criar = useNovoAgendamento()

  const [nome, setNome] = useState("")
  const [telefone, setTelefone] = useState("")
  const [barbeiro, setBarbeiro] = useState<string>("")
  const [escolhidos, setEscolhidos] = useState<number[]>([])
  const [data, setData] = useState(inicial.data)
  const [horario, setHorario] = useState(inicial.horario ?? "")
  const [obs, setObs] = useState("")
  const [erros, setErros] = useState<Record<string, string>>({})

  // reabre já preenchido com o horário/profissional clicado na grade
  useEffect(() => {
    if (!aberto) return
    setData(inicial.data)
    setHorario(inicial.horario ?? "")
    setBarbeiro(inicial.barbeiroId ? String(inicial.barbeiroId) : "")
    setErros({})
  }, [aberto, inicial])

  const ativosProf = profissionais.filter((p) => p.active)
  const ativosServ = servicos.filter((s) => s.active)
  const total = ativosServ.filter((s) => escolhidos.includes(s.id)).reduce((t, s) => t + Number(s.price), 0)
  const duracao = ativosServ.filter((s) => escolhidos.includes(s.id)).reduce((t, s) => t + Number(s.duration_time), 0)

  const limpar = () => {
    setNome("")
    setTelefone("")
    setEscolhidos([])
    setObs("")
  }

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    const faltando: Record<string, string> = {}
    if (!nome.trim()) faltando.clienteNome = "Informe o nome do cliente."
    if (telefone.replace(/\D/g, "").length < 10) faltando.clienteTelefone = "Informe o telefone com DDD."
    if (!barbeiro) faltando.barbeiroId = "Escolha o profissional."
    if (!escolhidos.length) faltando.servicosIds = "Escolha ao menos um serviço."
    if (!horario) faltando.horario = "Informe o horário."
    setErros(faltando)
    if (Object.keys(faltando).length) return

    criar.mutate(
      {
        clienteNome: nome.trim(),
        clienteTelefone: telefone,
        barbeiroId: Number(barbeiro),
        servicosIds: escolhidos,
        dataAgendamento: data,
        horario,
        observacoes: obs.trim() || undefined,
      },
      {
        onSuccess: () => {
          limpar()
          onFechar()
        },
        onError: (err) => {
          if (err instanceof ApiError && err.errors) {
            setErros(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])))
          } else {
            setErros({ geral: err.message })
          }
        },
      },
    )
  }

  const erro = (campo: string) =>
    erros[campo] ? <p className="text-sm text-destructive">{erros[campo]}</p> : null

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>Para o cliente que ligou ou chegou no balcão. Já fica confirmado.</DialogDescription>
        </DialogHeader>

        <form id="form-novo" onSubmit={enviar} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="n-nome">Cliente</Label>
              <Input id="n-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" />
              {erro("clienteNome")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="n-tel">Telefone</Label>
              <Input id="n-tel" type="tel" inputMode="tel" placeholder="(11) 99999-9999" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              {erro("clienteTelefone")}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Profissional</Label>
            <Select value={barbeiro} onValueChange={setBarbeiro}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Escolha o profissional" />
              </SelectTrigger>
              <SelectContent>
                {ativosProf.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {erro("barbeiroId")}
          </div>

          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">Serviços</legend>
            <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border p-2">
              {ativosServ.length === 0 && <p className="p-2 text-sm text-muted-foreground">Cadastre serviços primeiro.</p>}
              {ativosServ.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted">
                  <Checkbox
                    checked={escolhidos.includes(s.id)}
                    onCheckedChange={(v) => setEscolhidos((atual) => (v ? [...atual, s.id] : atual.filter((id) => id !== s.id)))}
                  />
                  <span className="flex-1 text-sm">{s.name}</span>
                  <span className="text-sm text-muted-foreground tabular">
                    {s.duration_time} min · {moeda(s.price)}
                  </span>
                </label>
              ))}
            </div>
            {escolhidos.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Total: {moeda(total)} · {duracao} min
              </p>
            )}
            {erro("servicosIds")}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="n-data">Dia</Label>
              <Input id="n-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
              {erro("dataAgendamento")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="n-hora">Horário</Label>
              <Input id="n-hora" type="time" step={300} value={horario} onChange={(e) => setHorario(e.target.value)} />
              {erro("horario")}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="n-obs">Observação (opcional)</Label>
            <Textarea id="n-obs" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>

          {erros.geral && <p className="text-sm text-destructive">{erros.geral}</p>}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-novo" disabled={criar.isPending}>
            {criar.isPending ? "Marcando…" : "Marcar horário"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
