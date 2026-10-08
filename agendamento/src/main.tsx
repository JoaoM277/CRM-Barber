import { lazy, StrictMode, Suspense } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import "./index.css"

// ?h=<token>: o cliente abrindo o próprio horário (cancelar/remarcar)
const MeuHorario = lazy(() => import("./MeuHorario"))
const token = new URLSearchParams(location.search).get("h")

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {token ? (
      <Suspense fallback={null}>
        <MeuHorario token={token} />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
