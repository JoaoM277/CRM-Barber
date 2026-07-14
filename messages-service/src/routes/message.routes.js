const express = require("express");
const routes = express.Router();
const { messageController } = require("../controllers/message.controller");

routes.post("/", (req, res) => {
  resposta = messageController(req);

  res.status(200).json({ resposta });
});

module.exports = routes;
