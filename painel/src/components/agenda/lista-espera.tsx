import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Hourglass, MessageCircle, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { api } from "@/lib/api"
import { dataLonga, fone } from "@/lib/format"

type Entrada = { id: number; status: "aguardando" | "avisado" | "agendou"; cliente: string | null; telefone: string | null; profissional: string | null; avisado_em: string | null; criado_em: string }

const STATUS: Record<Entrada["status"], { texto: string; classe: string }> = {
  aguardando: { texto: "Esperando", classe: "border-warning/50 bg-warning/10 text-warning" },
  avisado: { texto: "Avisado da vaga", classe: "border-primary/40 bg-primary/10 text-primary" },
  agendou: { texto: "Conseguiu horário", classe: "border-success/50 bg-success/10 text-success" },
}

/** Quem pediu aviso de vaga neste dia (aparece só quando tem alguém). */
export function ListaEsperaDia({ data }: { data: string }) {
  const qc = useQueryClient()
  const [aberta, setAberta] = useState(false)
  const { data: lista = [] } = useQuery({ queryKey: ["lista-espera", data], queryFn: () => api<Entrada[]>(`/lista-espera?data=${data}`) })
  const remover = useMutation({
    mutationFn: (id: number) => api(`/lista-espera/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lista-espera", data] })
      toast.success("Removido da lista de espera.")
    },
    onError: (e) => toast.error(e.message),
  })

  const esperando = lista.filter((e) => e.status !== "agendou").length
  if (!lista.length) return null

  return (
    <>
      <Button variant="outline" onClick={() => setAberta(true)}>
        <Hourglass aria-hidden /> Lista de espera {esperando > 0 && <Badge variant="secondary">{esperando}</Badge>}
      </Button>
      <Sheet open={aberta} onOpenChange={setAberta}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Lista de espera</SheetTitle>
            <SheetDescription className="first-letter:uppercase">
              {dataLonga(data)}. Quando um horário deste dia é cancelado, os primeiros da lista recebem o aviso no WhatsApp.
            </SheetDescription>
          </SheetHeader>
          <ul className="divide-y px-4 pb-6">
            {lista.map((e, i) => {
              const wa = e.telefone?.replace(/\D/g, "")
              return (
                <li key={e.id} className="flex items-center gap-3 py-3">
                  <span className="w-5 text-sm tabular text-muted-foreground">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.cliente ?? "Cliente"}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.telefone ? fone(e.telefone) : ""}{e.profissional ? ` · prefere ${e.profissional}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className={STATUS[e.status].classe}>{STATUS[e.status].texto}</Badge>
                  {wa && (
                    <Button size="icon" variant="ghost" asChild>
                      <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener" aria-label={`Chamar ${e.cliente ?? "cliente"} no WhatsApp`}><MessageCircle aria-hidden /></a>
                    </Button>
                  )}
                  {e.status !== "agendou" && (
                    <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" aria-label="Tirar da lista" onClick={() => remover.mutate(e.id)}>
                      <Trash2 aria-hidden />
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  )
}
