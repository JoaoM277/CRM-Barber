const { MakeMessageResponseDTO } = require("../dtos/response.dtos");
require("dotenv").config();

const providerMenssage = async (to, respost) => {
  const infobipPayload = {
    from: process.env.INFOBIP_WHATSAPP_NUMBER,
    to: to.replace(/\D/g, ""),
    content: {
      text: respost,
    },
  };

  console.log("=== DIAGNÓSTICO INFOBIP ===");
  console.log("Tipo do 'from':", typeof infobipPayload.from);
  console.log("Valor do 'from':", infobipPayload.from);
  console.log("JSON final enviado:", JSON.stringify(infobipPayload, null, 2));
  console.log("===========================");

  try {
    const response = await fetch(
      `${process.env.INFOBIP_BASE_URL}/whatsapp/1/message/text`,
      {
        method: "POST",
        headers: {
          Authorization: `App ${process.env.INFOBIP_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(infobipPayload),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro na resposta da InfoBip:", data);

      console.error(
        "Detalhes do Erro da Infobip:",
        JSON.stringify(data, null, 2),
      );

      return MakeMessageResponseDTO({
        sucess: false,
        messageId: null,
        provider: "Infobip",
        rawResponse: data,
      });
    }

    const sentMessage = data.messageId || data.messages?.[0].messageId || null;

    return MakeMessageResponseDTO({
      sucess: response.ok,
      messageId: sentMessage?.messageId || null,
      provider: "Infobip",
      rawResponse: data,
    });
  } catch (error) {
    console.error("Erro ao comunicar com a InfoBip:", error.message);

    return MakeMessageResponseDTO({
      sucess: false,
      messageId: null,
      provider: "Infobip-Teste",
      rawResponse: { error: error.message },
    });
  }
  //console.log("Enviando via Provider Fake");
  //console.log("Payload Enviado", JSON.stringify(infobipPayload, null, 2));

  /*const fakeResponse = {
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
  };*/
};

module.exports = { providerMenssage };
