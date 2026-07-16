const { z, ZodError } = require("zod");

const { messageService } = require("../services/messages.service");

const messageSchema = z.object({
  number: z.string().min(11, "O numero deve ter no minimo 11 digitos").max(13,"O numero deve ter no maximo 13 digitos"), 
  name: z.string().min(1, "Nome invalido"),
  type: z.string().min(1, "Tipo de mensagem invalido"),
});

const messageController = async (req, res) => {
  try {
    const dadosValidados = messageSchema.parse(req.body);
    console.log(dadosValidados.number)
    const newMessage = await messageService(
      dadosValidados.number,
      dadosValidados.name,
      dadosValidados.type,
    );
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
