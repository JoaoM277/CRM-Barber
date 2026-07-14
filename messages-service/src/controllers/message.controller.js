const { messageService } = require("../services/messages.service");

const messageController = (req) => {
  const bodymessage = req.body;
  const number = bodymessage.number;
  const name = bodymessage.name;
  const text = bodymessage.message;

  const newMessage = messageService(number, name, text);
  return newMessage;
};

module.exports = { messageController };
