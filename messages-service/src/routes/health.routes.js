const express = require("express");
const routes = express.Router();
// --------------------------------------------------------------------------
// 1. Rota de testes (Verificação de rotas)
// --------------------------------------------------------------------------
routes.get("/", (req, res) => {
  res.status(200).json({ service: "message service", status: "online" });
});

module.exports = routes;
