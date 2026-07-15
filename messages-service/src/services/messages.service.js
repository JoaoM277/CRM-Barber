const numList = [{ client: "Paul", number: "(99)9848484" }]; //mais tarde implementar a função de registrar no banco de dados
const mensageList = [
  {
    indice: "1",
    type: "Mensagem de Testes",
    content: "Esta é uma mensagem de testes, status 200",
  },
  {
    indice: "0",
    type: "Mensagem de erro",
    content: "Algo deu errado, tente novamente",
  },
];

const messageService = (number, name, type) => {
  //const typeMessage = type;
  const remetent = number;
  const client = name;
  //Logica de busca de info do cliente
  const searchBody = {
    client: client,
    number: remetent,
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

  const messageRespost = mensageList.find(item => item.indice === type)
  const respost = messageRespost.type+ ": " + messageRespost.content
  console.log(respost)

  return respost;
};

module.exports = { messageService };

