const express = require("express");
const routes = express.Router();
const { messageController } = require("../controllers/message.controller");

routes.post("/", async (req, res) => {
  resposta = await messageController(req);

  res.status(200).json({ resposta });
});

module.exports = routes;
