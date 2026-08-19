const express = require("express");
const routes = express.Router();
const { testControler } = require("../controllers/test.controller");

routes.post("/", testControler);

module.exports = routes;
