import { ArrowUpRight, Hammer } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Módulo ainda não migrado: aponta para a tela equivalente do painel antigo. */
export default function EmMigracao({ titulo }: { titulo: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <Hammer className="size-8 text-muted-foreground" aria-hidden />
      <p className="font-medium">{titulo} ainda está no painel anterior</p>
      <p className="max-w-sm text-sm text-muted-foreground">Esta tela está sendo refeita. Enquanto isso, ela continua funcionando no painel anterior.</p>
      <Button variant="outline" asChild>
        <a href="/admin.html">
          Abrir no painel anterior <ArrowUpRight aria-hidden />
        </a>
      </Button>
    </div>
  )
}
