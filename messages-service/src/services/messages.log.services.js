// --------------------------------------------------------------------------
// 1. Service de Logs de Mensagens
// --------------------------------------------------------------------------
const logProvider = require("../providers/message.log.provider");

class logService {
  async logRegisterCreator({ action, model, client_id, description, ip }) {
    if (!ip || !model) {
      console.warn(
        "[LogService Warning]: Tentativa de registro de log sem IP ou Gatilho",
      );
      return null;
    }

    const logData = { action, model, client_id, description, ip };

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
