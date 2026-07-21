const express = require("express");
const routes = express.Router();

routes.get("/", (req, res) => {
  res.status(200).json({ service: "message service", status: "online" });
});

module.exports = routes;
