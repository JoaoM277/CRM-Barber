const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

const healthRoutes = require("./routes/health.routes");
const messageRoutes = require("./routes/message.routes");

app.use(express.json());

app.use("/health", healthRoutes);
app.use("/message", messageRoutes);

app.listen(PORT, () => {
  console.log("Servidor rodando na porta: " + PORT);
});
