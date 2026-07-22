const { findMessageLogs } = require("../repository/messageLog.repository");


// --------------------------------------------------------------------------
// 1. Service de Logs de Mensagens
// --------------------------------------------------------------------------

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
