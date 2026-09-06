const { ZodError } = require("zod");

const { messageService } = require("../services/messages.service");
const { makeMessageDTO } = require("../dtos/message.dtos");

// --------------------------------------------------------------------------
// 1. Responsavel pela validação de Padrão de dados e por chamar o service.message
// --------------------------------------------------------------------------

const messageController = async (req, res) => {
  console.log(req.body);
  try {
    const parsed = makeMessageDTO(req.body);

    if (!parsed.success) {
      return res.status(400).json({ erros: parsed.error.flatten().fieldErrors });
    }

    const ip = req.ip || req.socket?.remoteAddress || null;
    const newMessage = await messageService({ ...parsed.data, ip });
    console.log(newMessage);
    return res.status(200).json(newMessage);
  } catch (error) {
    console.log(error);
    if (error instanceof ZodError) {
      return res.status(400).json({ erros: error.flatten().fieldErrors });
    }
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

module.exports = { messageController };
