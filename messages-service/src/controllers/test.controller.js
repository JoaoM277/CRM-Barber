const { createInstance } = require("../services/evolution.service");
const { conectInstance } = require("../services/evolution.service");
const { verifyInstance } = require("../services/evolution.service");
const { desconectInstance } = require("../services/evolution.service");
const { deletetInstance } = require("../services/evolution.service");

const testControler = async (req, res) => {
  const respostas = await deletetInstance (req.body.name);
  return res.status(200).json(respostas);
};

module.exports = { testControler };
