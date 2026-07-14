const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

const healthRoutes = require("./routes/healthRoute");

app.use(express.json());

app.use("/health", healthRoutes);

app.listen(PORT, () => {
  console.log("Servidor rodando na porta: " + PORT);
});
