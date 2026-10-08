import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { deISO, hojeISO, somarDias } from "@/lib/format"

function periodoDe(chave: string): { inicio: string; fim: string } {
  const hoje = hojeISO()
  const d = deISO(hoje)
  const z = (n: number) => String(n).padStart(2, "0")
  const iniMes = `${d.getFullYear()}-${z(d.getMonth() + 1)}-01`
  switch (chave) {
    case "7d":
      return { inicio: somarDias(hoje, -6), fim: hoje }
    case "30d":
      return { inicio: somarDias(hoje, -29), fim: hoje }
    case "90d":
      return { inicio: somarDias(hoje, -89), fim: hoje }
    case "mes-passado": {
      const fimAnt = somarDias(iniMes, -1)
      return { inicio: `${fimAnt.slice(0, 7)}-01`, fim: fimAnt }
    }
    default:
      return { inicio: iniMes, fim: hoje }
  }
}

/** Período escolhido na tela (atalhos ou datas livres). */
export function usePeriodo(inicial = "mes") {
  const [chave, setChave] = useState(inicial)
  const [personalizado, setPersonalizado] = useState(periodoDe(inicial))
  const { inicio, fim } = chave === "custom" ? personalizado : periodoDe(chave)
  return { chave, setChave, personalizado, setPersonalizado, inicio, fim }
}

export function SeletorPeriodo({ periodo, nota, com90 }: { periodo: ReturnType<typeof usePeriodo>; nota?: string; com90?: boolean }) {
  const { chave, setChave, personalizado, setPersonalizado } = periodo
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label>Período</Label>
        <Select value={chave} onValueChange={setChave}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mes">Este mês</SelectItem>
            <SelectItem value="mes-passado">Mês passado</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            {com90 && <SelectItem value="90d">Últimos 90 dias</SelectItem>}
            <SelectItem value="custom">Escolher datas</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {chave === "custom" && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="p-ini">De</Label>
            <Input id="p-ini" type="date" value={personalizado.inicio} onChange={(e) => setPersonalizado({ ...personalizado, inicio: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-fim">Até</Label>
            <Input id="p-fim" type="date" value={personalizado.fim} onChange={(e) => setPersonalizado({ ...personalizado, fim: e.target.value })} />
          </div>
        </>
      )}
      {nota && <p className="pb-2 text-sm text-muted-foreground">{nota}</p>}
    </div>
  )
}
