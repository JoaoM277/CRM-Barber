import { useRef, useState } from "react"
import { Camera, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { api, enviarArquivo } from "@/lib/api"
import { cn } from "@/lib/utils"

/**
 * Escolher/trocar/remover uma imagem quadrada (logo ou foto).
 * O servidor recorta, reduz e converte; aqui só mostra a prévia e envia.
 */
export function EnviarImagem({
  atual, rotulo, inicial, enviarPara, removerEm, onMudou, redonda,
}: {
  atual: string | null
  rotulo: string
  inicial: string
  enviarPara: string
  removerEm: string
  onMudou: () => void
  redonda?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)

  const escolher = async (arquivo: File | undefined) => {
    if (!arquivo) return
    if (arquivo.size > 5 * 1024 * 1024) {
      toast.error("A imagem pode ter no máximo 5 MB.")
      return
    }
    setEnviando(true)
    try {
      await enviarArquivo(enviarPara, arquivo)
      toast.success(`${rotulo} atualizado.`)
      onMudou()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setEnviando(false)
      if (input.current) input.current.value = ""
    }
  }

  const remover = async () => {
    setEnviando(true)
    try {
      await api(removerEm, { method: "DELETE" })
      toast.success(`${rotulo} removido.`)
      onMudou()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={enviando}
        className={cn("group relative grid size-20 shrink-0 place-items-center overflow-hidden border bg-secondary text-2xl font-semibold", redonda ? "rounded-full" : "rounded-2xl")}
        aria-label={atual ? `Trocar ${rotulo.toLowerCase()}` : `Enviar ${rotulo.toLowerCase()}`}
      >
        {atual ? <img src={atual} alt="" className="size-full object-cover" /> : <span aria-hidden>{inicial}</span>}
        <span className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          {enviando ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Camera className="size-5" aria-hidden />}
        </span>
      </button>
      <div className="grid gap-1.5">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()} disabled={enviando}>
            {atual ? "Trocar" : "Enviar imagem"}
          </Button>
          {atual && (
            <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={remover} disabled={enviando}>
              <Trash2 aria-hidden /> Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG ou WebP, até 5 MB. Fica quadrada.</p>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => escolher(e.target.files?.[0])} />
    </div>
  )
}
