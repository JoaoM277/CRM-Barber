import { useEffect, useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CheckCircle2, Loader2, MessageCircle, RefreshCw, Smartphone, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Confirmar } from "@/components/confirmar"
import { useBarbearia, useRecurso } from "@/hooks/use-sessao"
import { api } from "@/lib/api"
import { dataBR, fone } from "@/lib/format"

type Instancia = { id: number; name: string; status: "conectado" | "conectando" | "desconectado" | "erro"; phone_number: string | null; last_connected_at: string | null }
type Lista = { data: Instancia[]; conectadas: number; alerta_sem_whatsapp: boolean; lembretes_whatsapp: boolean }

const STATUS: Record<Instancia["status"], { texto: string; classe: string }> = {
  conectado: { texto: "Conectado", classe: "border-success/50 bg-success/10 text-success" },
  conectando: { texto: "Aguardando leitura do QR", classe: "border-warning/50 bg-warning/10 text-warning" },
  desconectado: { texto: "Desconectado", classe: "border-destructive/40 bg-destructive/10 text-destructive" },
  erro: { texto: "Com erro", classe: "border-destructive/40 bg-destructive/10 text-destructive" },
}

/** QR Code + acompanhamento da conexão (consulta o status a cada 3 s). */
function Conectar({ instancia, qrInicial, onFechar }: { instancia: Instancia | null; qrInicial: string | null; onFechar: () => void }) {
  const qc = useQueryClient()
  const [qr, setQr] = useState<string | null>(qrInicial)
  const [conectado, setConectado] = useState(false)

  useEffect(() => {
    setQr(qrInicial)
    setConectado(false)
  }, [instancia, qrInicial])

  // sem QR ainda (reconectar): pede um novo
  useEffect(() => {
    if (!instancia || qrInicial) return
    api<{ qrCode: string | null }>(`/instances/${instancia.id}/qrcode`).then((r) => setQr(r.qrCode)).catch((e) => toast.error(e.message))
  }, [instancia, qrInicial])

  useEffect(() => {
    if (!instancia || conectado) return
    const t = setInterval(async () => {
      try {
        const r = await api<{ status: string }>(`/instances/${instancia.id}/status`)
        if (r.status === "conectado") {
          setConectado(true)
          qc.invalidateQueries({ queryKey: ["instancias"] })
          qc.invalidateQueries({ queryKey: ["onboarding"] })
          toast.success("WhatsApp conectado! As confirmações já saem por ele.")
        }
      } catch {
        /* tenta de novo no próximo ciclo */
      }
    }, 3000)
    return () => clearInterval(t)
  }, [instancia, conectado, qc])

  return (
    <Dialog open={!!instancia} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{conectado ? "WhatsApp conectado" : "Conecte o WhatsApp da barbearia"}</DialogTitle>
          <DialogDescription>
            {conectado
              ? "Pronto. Os clientes vão receber a confirmação do agendamento por este número."
              : "No celular da barbearia: WhatsApp → Configurações → Aparelhos conectados → Conectar um aparelho, e aponte para o código."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid place-items-center py-2">
          {conectado ? (
            <CheckCircle2 className="size-20 text-success" aria-hidden />
          ) : qr ? (
            <img src={qr} alt="QR Code para conectar o WhatsApp" className="size-64 rounded-lg bg-white p-2" />
          ) : (
            <div className="grid size-64 place-items-center rounded-lg border">
              <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Gerando QR Code" />
            </div>
          )}
          {!conectado && (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Aguardando a leitura do código…
            </p>
          )}
        </div>
        {conectado && <Button onClick={onFechar}>Concluir</Button>}
      </DialogContent>
    </Dialog>
  )
}

export default function WhatsApp() {
  const qc = useQueryClient()
  const temRecurso = useRecurso("whatsapp")
  const { data: barbearia } = useBarbearia()
  const [conectando, setConectando] = useState<{ inst: Instancia; qr: string | null } | null>(null)
  const [remover, setRemover] = useState<Instancia | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ["instancias"], queryFn: () => api<Lista>("/instances") })
  const instancias = data?.data ?? []

  const criar = useMutation({
    mutationFn: () => {
      // nome técnico gerado (o dono não precisa saber o que é uma "instância")
      const base = (barbearia?.slug ?? "barbearia").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40)
      return api<{ instance: Instancia; qrCode: string | null }>("/instances", { method: "POST", body: { name: `${base}-${Date.now().toString(36)}` } })
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["instancias"] })
      setConectando({ inst: r.instance, qr: r.qrCode })
    },
    onError: (e) => toast.error(e.message),
  })
  const lembretes = useMutation({
    mutationFn: (ativo: boolean) => api<{ message: string }>("/whatsapp/lembretes", { method: "PUT", body: { ativo } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["instancias"] })
      toast.success(r.message)
    },
    onError: (e) => toast.error(e.message),
  })
  const apagar = useMutation({
    mutationFn: (i: Instancia) => api(`/instances/${i.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instancias"] })
      toast.success("Número desconectado.")
    },
    onError: (e) => toast.error(e.message),
  })

  if (!temRecurso) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
        <MessageCircle className="size-8 text-muted-foreground" aria-hidden />
        <p className="font-medium">A confirmação automática no WhatsApp faz parte do plano Pro</p>
        <p className="max-w-md text-sm text-muted-foreground">Cada agendamento feito pelo seu link dispara uma mensagem de confirmação para o cliente, do número da barbearia.</p>
        <Button asChild><Link to="/assinatura">Ver planos</Link></Button>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Confirmação automática</CardTitle>
          <CardDescription>
            Quando um cliente agenda pelo seu link, ele recebe a confirmação no WhatsApp, enviada do número da barbearia.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {data?.conectadas ? (
            <span className="inline-flex items-center gap-2 font-medium text-success">
              <CheckCircle2 className="size-5" aria-hidden /> Ativa
            </span>
          ) : (
            <span className="text-muted-foreground">Nenhum número conectado: as confirmações não estão saindo.</span>
          )}
          <Button className="ml-auto" onClick={() => criar.mutate()} disabled={criar.isPending}>
            <Smartphone aria-hidden /> {instancias.length ? "Conectar outro número" : "Conectar WhatsApp"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Lembretes automáticos</CardTitle>
            <CardDescription>
              O cliente recebe um lembrete 24h antes e outro 2h antes do horário (só entre 8h e 21h). Se ainda não confirmou,
              pode responder <strong>1</strong> para confirmar ou <strong>2</strong> para cancelar — a agenda atualiza sozinha.
            </CardDescription>
          </div>
          <Switch
            checked={data?.lembretes_whatsapp ?? true}
            disabled={!data || lembretes.isPending}
            onCheckedChange={(v) => lembretes.mutate(v)}
            aria-label="Lembretes automáticos"
          />
        </CardHeader>
      </Card>

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : instancias.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Números conectados</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {instancias.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{i.phone_number ? fone(i.phone_number) : "Número ainda não identificado"}</p>
                    <p className="text-xs text-muted-foreground">{i.last_connected_at ? `Conectado em ${dataBR(i.last_connected_at)}` : "Nunca conectado"}</p>
                  </div>
                  <Badge variant="outline" className={STATUS[i.status]?.classe}>{STATUS[i.status]?.texto ?? i.status}</Badge>
                  {i.status !== "conectado" && (
                    <Button size="sm" variant="outline" onClick={() => setConectando({ inst: i, qr: null })}>
                      <RefreshCw aria-hidden /> Reconectar
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" aria-label="Desconectar número" onClick={() => setRemover(i)}>
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Use um número da barbearia. O WhatsApp pode bloquear números que enviam muitas mensagens para quem não os conhece; as confirmações vão só para quem agendou.
      </p>

      <Conectar instancia={conectando?.inst ?? null} qrInicial={conectando?.qr ?? null} onFechar={() => setConectando(null)} />
      <Confirmar
        aberto={!!remover}
        titulo="Desconectar este número?"
        descricao="As confirmações deixam de sair por ele. Você pode conectar de novo quando quiser."
        acao="Desconectar"
        onConfirmar={() => remover && apagar.mutate(remover)}
        onFechar={() => setRemover(null)}
      />
    </div>
  )
}
