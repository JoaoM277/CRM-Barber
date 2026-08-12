const logService = require("../services/messages.log.services");

// --------------------------------------------------------------------------
// 1. Responsavel pela validação de busca dos logs e por chamar o service.logs
// --------------------------------------------------------------------------

class logController {
  async ControllerLogs(payload) {
    try {
      return await logService.logRegisterCreator(payload);
    } catch (error) {
      console.error(
        "[LogController Falback Error]: Falha ao enviar Log pra o Service ->",
        error.message,
      );
      return null;
    }
  }
}

module.exports = new logController();
