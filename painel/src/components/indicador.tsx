import { Card, CardContent } from "@/components/ui/card"

/** Número de destaque com rótulo (topo do financeiro e dos relatórios). */
export function Indicador({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="px-5">
        <p className="text-sm text-muted-foreground">{rotulo}</p>
        <p className="mt-1 text-2xl font-semibold tabular">{valor}</p>
        {nota && <p className="mt-0.5 text-xs text-muted-foreground">{nota}</p>}
      </CardContent>
    </Card>
  )
}
