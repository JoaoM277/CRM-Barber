const express = require("express");

const router = express.Router();
const {
  getMessageLogController,
} = require("../controllers/message.log.controller");

router.get("/", getMessageLogController);

module.exports = router;
