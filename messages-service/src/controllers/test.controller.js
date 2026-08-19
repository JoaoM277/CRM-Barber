const { createInstance } = require("../services/evolution.service");

const testControler = async (req, res) => {
  const respostas = await createInstance(req.body.name);
  return res.status(200).json(respostas);
};

module.exports = { testControler };
