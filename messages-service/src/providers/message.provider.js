const { MakeMessageResponseDTO } = require("../dtos/response.dtos");
require("dotenv").config();

// --------------------------------------------------------------------------
// 1. Cria o Payload da API em questão (InfoBip - Whatsapp)
// --------------------------------------------------------------------------

const providerMessage = async (to, respost) => {
  const infobipPayload = {
    from: process.env.INFOBIP_WHATSAPP_NUMBER,
    to: to.replace(/\D/g, ""),
    content: {
      text: respost,
    },
  };


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
  
};

module.exports = { providerMessage };
