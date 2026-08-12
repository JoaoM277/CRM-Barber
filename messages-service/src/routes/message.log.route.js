const express = require("express");

const router = express.Router();
const {
  logController
} = require("../controllers/message.log.controller");

// --------------------------------------------------------------------------
// 2. Rota de Log de Mensagens
// --------------------------------------------------------------------------

//router.get("/", logController);

module.exports = router;
