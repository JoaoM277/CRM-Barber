// --------------------------------------------------------------------------
// 1. Service de Logs de Mensagens
// --------------------------------------------------------------------------
const logProvider = require("../providers/message.log.provider");

class logService {
  async logRegisterCreator({
    phone,
    trigger,
    message,
    sucess = true,
    errorReason = null,
    responseCode = null,
  }) {
    if (!phone || !trigger) {
      console.warn(
        "[LogService Warning]: Tentativa de registro de log sem Telefone ou Gatilho",
      );
      return null;
    }

    let CleanPhone = String(phone).replace(/\D/g, "");

    let status = "SENT";

    if (!sucess) {
      status = "REJECTED_PREFIX_MISSING" ? "REJECTED" : "FAILED";
    }

    const logData = {
      phone: CleanPhone,
      trigger: trigger.toUpperCase(),
      status,
      message: message || null,
      errorReason: errorReason || null,
      responsecode: responseCode || null,
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
