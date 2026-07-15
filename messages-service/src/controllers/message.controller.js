const { messageService } = require("../services/messages.service");

const messageController = (req) => {
  const bodymessage = req.body;
  const number = bodymessage.number;//Pra quem vai a mensagem?
  const name = bodymessage.name;//Qual o nome do remetente?
  const order = bodymessage.type;//Qual tipo de mensagem?

  const newMessage = messageService(number, name, order);
  return newMessage;
};

module.exports = { messageController };
