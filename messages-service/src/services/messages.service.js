const { providerMenssage } = require("../providers/message.provider");

const numList = [{ client: "Paul", number: "99984825723" }]; //mais tarde implementar a função de registrar no banco de dados
const mensageList = [
  {
    event: "test.event",
    type: "Mensagem de Testes",
    content: "Esta é uma mensagem de testes, status 200",
  },
  {
    event: "error.event",
    type: "Mensagem de erro",
    content: "Algo deu errado, tente novamente",
  },
  {
    event: "created.event",
    type: "Mensagem de erro",
    content: "Algo deu errado, tente novamente",
  },
  {
    event: "canceled.event",
    type: "Mensagem de erro",
    content: "Algo deu errado, tente novamente",
  }
];

const messageService = async (mensageData) => {
  const { number, name, event } = mensageData;
  
 
  //Logica de busca de info do cliente
  const searchBody = {
    client: name,
    number: number,
  };
  const clientExists = numList.some(
    (item) => item.number === searchBody.number,
  );
  if (clientExists) {
    const clienteSearched = numList.find(
      (item) => item.number === searchBody.number,
    );
    console.log(clienteSearched.client, "certo");
  } else {
    numList.push(searchBody);
  }
  //Logica de seleção de mensagem

  const messageRespost = mensageList.find((item) => item.event === event);
  const respost = messageRespost.event + ": " + messageRespost.content;
  const response = await providerMenssage(number, respost);

  return response;
};

module.exports = { messageService };
