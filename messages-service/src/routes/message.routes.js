const express = require("express");
const routes = express.Router();
const { messageController } = require("../controllers/message.controller");

// --------------------------------------------------------------------------
// 3. Rota de mensagens
// --------------------------------------------------------------------------

routes.post("/", messageController)

module.exports = routes;
