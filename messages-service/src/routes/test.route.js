const express = require("express");
const routes = express.Router();
const { createnGetInstanceController } = require("../controllers/evolution.controller");
const { testControler } = require("../controllers/evolution.controller");
const { connectSecondInstanceController } = require("../controllers/evolution.controller");
const { verifyInstanceController  } = require("../controllers/evolution.controller");
const { desconectInstanceController   } = require("../controllers/evolution.controller");
const { deleteInstanceController  } = require("../controllers/evolution.controller");


routes.post("/", deleteInstanceController );

module.exports = routes;
