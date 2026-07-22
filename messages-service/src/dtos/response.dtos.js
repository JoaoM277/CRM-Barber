// --------------------------------------------------------------------------
// 2. Corpo de Validação de Respostas indo pra API
// --------------------------------------------------------------------------


const MakeMessageResponseDTO = ({
  sucess,
  messageId,
  provider,
  rawResponse,
  errorMensage = null,
}) => {
  return {
    sucess: sucess,
    messageId: messageId,
    provider: provider,
    errorMensage: errorMensage,
    timestamp: new Date(),
    rawResponse: rawResponse,
  };
};

module.exports = { MakeMessageResponseDTO };
