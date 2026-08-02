class logProvider{
    constructor(){
        this.apiUrl = "rota da api de log",
        this.apiToken = "caso precise"
    }
}

const logToBackend = (logData)=>{
   const payload = {
     trigger: logData.trigger,
     status: logData.status,
     phone: logData.phone,
     message: logData.message || null,
     error_reason: logData.error || null,
     response_code: logData.responseCod || null,
     service: "whatsapp-"
   }
}
