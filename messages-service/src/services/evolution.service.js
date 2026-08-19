const axios = require("axios");
const qrcode = require("qrcode-terminal");

require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env"),
});

const makeResponse = ({
  success,
  action,
  instanceName,
  status,
  data = null,
  error = null,
}) => ({
  success,
  action,
  instanceName,
  status,
  data,
  error,
});
const evolution = axios.create({
  baseURL: process.env.EVOLUTION_URL,
  headers: {
    apikey: process.env.EVOLUTION_API_KEY,
    "Content-Type": "application/json",
  },
});

const createInstance = async (nome) => {
  try {
    const instancia = await evolution.post("/instance/create/", {
      instanceName: nome,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    });
    return makeResponse({
      sucess: true,
      action: "create",
      instanceName: nome,
      status: instancia.data.status,
      data: {
        qrCode: instancia.data.base64 ?? null,
        pairingCode: instancia.data.pairingCode ?? null,
      },
    });
  } catch (erro) {
    return makeResponse({
      sucess: false,
      action: "create",
      instanceName: nome,
      status: "erro",
      error: {
        code: erro.response?.status ?? "ERRO_NA_CRIAÇÃO_DA_INSTANCIA",
        message:
          erro.response?.data?.response?.message?.[0] ??
          "Não foi possível conectar a instância.",
      },
    });
  }
};

const conectInstance = async (nome) => {
  try {
    const response = await evolution.get(`/instance/connect/${nome}`);
    console.dir(response.data, { depth: null });

    if (!response) {
      console.log("Nada retornado da API");
      return makeResponse({
        sucess: false,
        action: "connect",
        instanceName: nome,
        status: response.data.status,
        data: {
          qrCode: response.data.base64 ?? null,
          pairingCode: response.data.pairingCode ?? null,
        },
      });
    }

    return makeResponse({
      sucess: true,
      action: "connect",
      instanceName: nome,
      status: response.data.status,
      data: {
        qrCode: response.data.base64 ?? null,
        pairingCode: response.data.pairingCode ?? null,
      },
    });
  } catch (erro) {
    return makeResponse({
      sucess: false,
      action: "connect",
      instanceName: nome,
      status: "erro",
      error: {
        code: erro.response?.status ?? "ERRO_NA_CONEXÃO_DA_INSTANCIA",
        message:
          erro.response?.data?.response?.message?.[0] ??
          "Não foi possível conectar a instância.",
      },
    });
  }
};

const verifyInstance = async (nome) => {
  try {
    const response = await evolution.get(`/instance/connectionState/${nome}`);
    const state = response.data.instance.state;
    return makeResponse({
      sucess: true,
      action: "verify",
      instanceName: nome,
      status: state,
      data: {
        qrCode: response.data.base64 ?? null,
        pairingCode: response.data.pairingCode ?? null,
      },
    });
  } catch (erro) {
    return makeResponse({
      sucess: false,
      action: "verify",
      instanceName: nome,
      status: "erro",
      error: {
        code: erro.response?.status ?? "ERRO_NA_VERIFY_DA_INSTANCIA",
        message:
          erro.response?.data?.response?.message?.[0] ??
          "Não foi possível verificar a instância.",
      },
    });
  }
};

const desconectInstance = async (nome) => {
  try {
    const logout = await evolution.delete(`/instance/logout/${nome}`);
    return makeResponse({
      sucess: true,
      action: "desconect",
      instanceName: nome,
      status: logout,
      data: {
        qrCode: logout.data.base64 ?? null,
        pairingCode: logout.data.pairingCode ?? null,
      },
    });
  } catch (erro) {
    return makeResponse({
      sucess: false,
      action: "desconect",
      instanceName: nome,
      status: "erro",
      error: {
        code: erro.response?.status ?? "ERRO_AO_DESCONECTAR_DA_INSTANCIA",
        message:
          erro.response?.data?.response?.message?.[0] ??
          "Não foi possível desconectar da instância.",
      },
    });
  }
};

const deletetInstance = async (nome) => {
  try {
    const deleter = await evolution.delete(`/instance/delete/${nome}`);
    return makeResponse({
      sucess: true,
      action: "delete",
      instanceName: nome,
      status: deleter.data.status,
      data: {
        qrCode: deleter.data.base64 ?? null,
        pairingCode: deleter.data.pairingCode ?? null,
      },
    });
  } catch (erro) {
    return makeResponse({
      sucess: false,
      action: "delete",
      instanceName: nome,
      status: "erro",
      error: {
        code: erro.response?.status ?? "ERRO_AO_DELETAR_A_INSTANCIA",
        message:
          erro.response?.data?.response?.message?.[0] ??
          "Não foi possível deletar a instância.",
      },
    });
  }
};

module.exports = {
  evolution,
  createInstance,
  conectInstance,
  verifyInstance,
  desconectInstance,
  deletetInstance,
};
