const { providerMenssage } = require("../providers/message.provider");
const mensageList = require("../dictionary/templates.messages");
const numList = require("../dictionary/clientes.list");
//mais tarde implementar a função de registrar no banco de dados

const messageService = async (mensageData) => {
  const { phone, name, event } = mensageData;

  //Logica de busca de info do cliente
  const searchBody = {
    client: name,
    phone: phone,
  };
  const clientExists = numList.some(
    (item) => item.phone === searchBody.phone,
  );
  if (clientExists) {
    const clienteSearched = numList.find(
      (item) => item.phone === searchBody.phone,
    );
    console.log(clienteSearched.client, "certo");
  } else {
    numList.push(searchBody);
  }
  //Logica de seleção de mensagem

  const messageRespost = mensageList.find((item) => item.event === event);
  const respost = messageRespost.event + ": " + messageRespost.content;
  const response = await providerMenssage(phone, respost);

  return response;
};

module.exports = { messageService };
