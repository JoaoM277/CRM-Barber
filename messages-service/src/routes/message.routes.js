const express = require("express");
const routes = express.Router();
const { messageController } = require("../controllers/message.controller");

routes.post("/", messageController)

module.exports = routes;
