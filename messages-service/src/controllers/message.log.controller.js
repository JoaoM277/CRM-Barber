const logService = require("../services/messages.log.services");

// --------------------------------------------------------------------------
// 1. Responsavel pela validação de busca dos logs e por chamar o service.logs
// --------------------------------------------------------------------------

class logController {
  async ControllerLogs(payload) {
    try {
      const { phone, trigger, message, errroReason, responseCode } = payload;

      return await logService.logRegisterCreator({
        phone,
        trigger,
        message,
        errroReason,
        responseCode,
      });
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
