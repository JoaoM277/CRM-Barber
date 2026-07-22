const express = require("express");

const router = express.Router();
const {
  getMessageLogController,
} = require("../controllers/message.log.controller");

// --------------------------------------------------------------------------
// 2. Rota de Log de Mensagens
// --------------------------------------------------------------------------

router.get("/", getMessageLogController);

module.exports = router;
