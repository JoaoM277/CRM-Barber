// --------------------------------------------------------------------------
// 2. Corpo de Validação de Respostas indo pra API
// --------------------------------------------------------------------------


const MakeMessageResponseDTO = ({
  sucess,
  messageId,
  provider,
  rawResponse,
  errorMessage = null,
}) => {
  return {
    sucess: sucess,
    messageId: messageId,
    provider: provider,
    errorMessage: errorMessage,
    timestamp: new Date(),
    rawResponse: rawResponse,
  };
};

module.exports = { MakeMessageResponseDTO };
