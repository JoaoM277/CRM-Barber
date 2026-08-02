class logProvider {
  constructor() {
    ((this.apiUrl = "rota da api de log"), (this.apiToken = "caso precise"));
  }

  async logToBackend(logData) {
    try {
      const payload = {
        trigger: logData.trigger,
        status: logData.status,
        phone: logData.phone,
        message: logData.message || null,
        error_reason: logData.error || null,
        response_code: logData.responseCod || null,
        service: "whatsapp-",
      };

      const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(`${this.apiUrl}/api/logs`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json().catch(() => {});
        throw new Error(errorData.message || `HTTP status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === "AbortError") {
        console.error(
          "[LogProvider Fallback Error]: Timeout de 4s excedido ao tentar enviar o log pro Laravel",
        );
      } else {
        console.error(
          "[LogProvider Falback Error]: Não foi possivel enviar Log ao Laravel ->",
          error.message,
        );
      }

      return null;
    }
  }
}

module.exports = new logProvider();
