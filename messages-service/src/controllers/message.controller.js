const { ZodError } = require("zod");

const { messageService } = require("../services/messages.service");
const { makeMessageDTO } = require("../dtos/mensage.dtos")

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
  //const bodymessage = req.body;
  //const number = bodymessage.number; //Pra quem vai a mensagem?
  //const name = bodymessage.name; //Qual o nome do remetente?
  //const order = bodymessage.type; //Qual tipo de mensagem?

  //return newMessage;
};

module.exports = { messageController };
