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
