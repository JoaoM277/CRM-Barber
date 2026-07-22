const { ZodError } = require("zod");

const { messageService } = require("../services/messages.service");
const { makeMessageDTO } = require("../dtos/mensage.dtos")

// --------------------------------------------------------------------------
// 1. Responsavel pela validação de Padrão de dados e por chamar o service.message
// --------------------------------------------------------------------------

const messageController = async (req, res) => {
  try {
    const messageDTO = makeMessageDTO(req.body)
    const newMessage = await messageService(messageDTO);
    return res.status(200).json(newMessage);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ erros: error.flatten().fieldErrors });
    }
    return res.status(500).json({ error: "Erro interno do servidor"});
  }
};

module.exports = { messageController };
