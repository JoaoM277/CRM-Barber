// --------------------------------------------------------------------------
// 1. Service de Logs de Mensagens
// --------------------------------------------------------------------------
const logProvider = require("../providers/message.log.provider");

class logService {
  async logRegisterCreator({ action, model, client_id, description, ip }) {
    if (!action) {
      console.warn("[LogService Warning]: log sem 'action', ignorado");
      return null;
    }

    const logData = {
      action,
      model: model ?? null,
      client_id: client_id ?? null,
      description: description ?? null,
      ip: ip ?? null,
    };

    return await logProvider.logToBackend(logData);
  }
}

module.exports = new logService();

/* const { findMessageLogs } = require("../repository/messageLog.repository");
//Antiga funcão de logs

const getLogsService = async (queryParams) => {
  const { trigger, status, page = 1, limit = 10 } = queryParams;

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(1, Math.max(1, parseInt(page, 10) || 10));

  const logs = await findMessageLogs({
    trigger,
    status,
    page: parsedPage,
    limit: parsedLimit,
  });

  return {
    page: parsedPage,
    limit: parsedLimit,
    totalRecords: logs.length,
    data: logs,
  };
};

module.exports = { getLogsService };
 */
