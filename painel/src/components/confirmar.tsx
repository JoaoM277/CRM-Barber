import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

/** Confirmação de ação destrutiva: o botão diz exatamente o que vai acontecer. */
export function Confirmar({
  aberto, titulo, descricao, acao, onConfirmar, onFechar,
}: {
  aberto: boolean
  titulo: string
  descricao: string
  acao: string
  onConfirmar: () => void
  onFechar: () => void
}) {
  return (
    <AlertDialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() => {
              onConfirmar()
              onFechar()
            }}
          >
            {acao}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
