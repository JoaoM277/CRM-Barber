const { MakeMessageResponseDTO } = require("../dtos/response.dtos");

const providerMenssage = async (to, respost) => {
  const infobipPayload = {
    messages: [
      {
        from: "CRM-Barber",
        destinations: [
          {
            to: to.replace(/\D/g, ""),
          },
        ],
        text: respost,
      },
    ],
  };

  console.log("Enviando via Provider Fake");
  console.log("Payload Enviado", JSON.stringify(infobipPayload, null, 2));

  const fakeResponse = {
    status: 200,
    data: {
      messages: [
        {
          to: to,
          status: {
            groupId: 1,
            groupName: "PENDING",
            id: 7,
            name: "PENDING_ENROUTE",
            description: "Mensagem enviada para a proxima instancia",
          },
          messageId: `fake-id-${Math.random().toString(36).substring(2, 9)}`,
        },
      ],
    },
  };

  return MakeMessageResponseDTO({
    sucess: fakeResponse.status === 200,
    messageId: fakeResponse.data.messages[0].messageId,
    provider: "Infobip-Teste",
    rawResponse: fakeResponse.data,
  });
};

module.exports = { providerMenssage };
