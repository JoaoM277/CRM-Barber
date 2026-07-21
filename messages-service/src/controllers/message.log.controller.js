const { getLogsService } = require("../services/messages.log.services");

const getMessageLogController = async (req, res) => {
  try {
    const queryParams = req.body;

    const logsData = await getLogsService(queryParams);

    return res.status(200).json({
      sucess: true,
      result: logsData,
    });
  } catch (error) {
    console.error("Erro ao buscar logs de mensagens:", error);
    return res.status(500).json({
      sucess: false,
      error: "Erro interno ao buscar historico de mensagens",
    });
  }
};

module.exports = { getMessageLogController };
