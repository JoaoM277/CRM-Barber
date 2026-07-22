const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// --------------------------------------------------------------------------
//                            INSTANCIAS
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// 1. Cria uma instancia da Rota de Verificação de estado do servidor (health)
// --------------------------------------------------------------------------
const healthRoutes = require("./routes/health.routes");
// --------------------------------------------------------------------------
// 2. Cria uma instancia da Rota Principal de Mensagens via whatsapp (messages)
// --------------------------------------------------------------------------
const messageRoutes = require("./routes/message.routes");
// --------------------------------------------------------------------------
// 3. Cria uma instancia da Rota de Registro de Logs (logs)
// --------------------------------------------------------------------------
const logRoutes = require("../src/routes/message.log.route");

app.use(express.json());
// --------------------------------------------------------------------------
//                             ROTAS
// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// 1. Chama Rota de Verificação de estado do servidor (health)
// --------------------------------------------------------------------------
app.use("/health", healthRoutes);
// --------------------------------------------------------------------------
// 2. Chama a Rota  Principal de Mensagens via whatsapp (messages)
// --------------------------------------------------------------------------
app.use("/message", messageRoutes);
// --------------------------------------------------------------------------
// 3. Chama a Rota de  Registro de Logs (logs)
// --------------------------------------------------------------------------
app.use("/logs", logRoutes);

app.listen(PORT, () => {
  console.log("Servidor rodando na porta: " + PORT);
});
