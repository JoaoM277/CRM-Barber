const { ZodError } = require("zod");

const { createInstance } = require("../services/evolution.service");
const { conectInstance } = require("../services/evolution.service");
const { verifyInstance } = require("../services/evolution.service");
const { desconectInstance } = require("../services/evolution.service");
const { deletetInstance } = require("../services/evolution.service");
const { makeSchemaEvolution } = require("../dtos/message.dtos");

const testControler = async (req, res) => {
  const respostas = await verifyInstance(req.body.name);
  return res.status(200).json(respostas);
};

//Função de conexão e geração de qr code da instancia
const createnGetInstanceController = async (req, res) => {
  try {
    const validation = makeSchemaEvolution(req.body);

    const name = validation.data.name;
    const generateInstance = await createInstance(name);
    const createState = generateInstance.success;

    if (!createState) {
      const createFailed = generateInstance.error.message;
      return res.status(500).json(createFailed);
    }

    const connectInstance = await conectInstance(name);
    const qrCode = connectInstance.data;
    const state = connectInstance.status;

    const responseConnect = {
      qrCode: qrCode,
      status: state,
    };

    return res.status(200).json(responseConnect);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ erros: error.flatten().fieldErrors });
    }
    return res.status(400).json(error.message);
  }
};

//Função de conexão da instancia
const connectSecondInstanceController = async (req, res) => {
  try {
    const validation = makeSchemaEvolution(req.body);

    if (!validation.success) {
      return res.status(400).json({
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const name = validation.data.name;
    const checked = await verifyInstance(name);
    const checkedState = checked.success;

    if (!checkedState) {
      const checkedFailed =
        checked.error?.message || "Erro ao verificar a instancia";
      return res.status(500).json({ erro: checkedFailed });
    }

    const state = checked.status;

    if (state === "close" || state === "refused") {
      const connectInstance = await conectInstance(name);
      const qrCode = connectInstance.data;

      const responseConnect = {
        message: "Instancia não conectada, tente novamente",
        qrCode: qrCode,
      };

      return res.status(200).json(responseConnect);
    }

    const response = {
      status: state,
      message: "Servidor conectado ou tentando estabelecer conexão",
    };

    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ erros: error.flatten().fieldErrors });
    }
    return res.status(400).json(error.message);
  }
};

//Função de verificação
const verifyInstanceController = async (req, res) => {
  try {
    const validation = makeSchemaEvolution(req.body);

    if (!validation.success) {
      return res.status(400).json({
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const name = validation.data.name;
    const checked = await verifyInstance(name);
    const checkedState = checked.success;

    if (!checkedState) {
      const checkedFailed =
        checked.error?.message || "Erro ao verificar a instancia";
      return res.status(500).json({ erro: checkedFailed });
    }

    const state = checked.status;

    return res.status(200).json({ status: state });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ erros: error.flatten().fieldErrors });
    }
    return res.status(400).json(error.message);
  }
};
const desconectInstanceController = async (req, res) => {
  try {
    const validation = makeSchemaEvolution(req.body);

    if (!validation.success) {
      return res.status(400).json({
        errors: validation.error.flatten().fieldErrors,
      });
    }
    const name = validation.data.name;

    const desconect = await desconectInstance(name);

    if (!desconect.success) {
      const desconectFailed =
        desconect.error?.code || "Erro ao desconectar a instancia";
      return res.status(500).json({ erro: desconectFailed });
    }

    return res.status(200).json({
      message: "Instancia desconectada com sucesso",
      data: desconect.data ?? desconect.action ?? null,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ erros: error.flatten().fieldErrors });
    }
    return res.status(400).json(error.message);
  }
};

const deleteInstanceController = async (req, res) => {
  try {
    const validation = makeSchemaEvolution(req.body);

    if (!validation.success) {
      return res.status(400).json({
        errors: validation.error.flatten().fieldErrors,
      });
    }
    const name = validation.data.name;

    const deleter = await deletetInstance(name);

    if (!deleter.success) {
      const deleterFailed =
        deleter.error?.code || "Erro ao deletar a instancia";
      return res.status(500).json({ erro: deleterFailed });
    }

    return res.status(200).json({
      message: "Instancia desconectada com sucesso",
      data: deleter.data ?? deleter.action ?? null,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ erros: error.flatten().fieldErrors });
    }
    return res.status(400).json(error.message);
  }
};

module.exports = {
  testControler,
  createnGetInstanceController,
  connectSecondInstanceController,
  verifyInstanceController,
  desconectInstanceController,
  deleteInstanceController,
};
