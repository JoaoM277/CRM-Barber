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
        message:erro.response?.data?.response?.message?.[0] ??
          "Não foi possível conectar a instância.",
      }
    });
  }
};

const conectInstance = async (nome) => {
  try {
    const resposta = await evolution.get(`/instance/connect/${nome}`);
    console.dir(resposta.data, { depth: null });
    const qrText = resposta.data.code;

    if (!qrText) {
      console.log("Nada retornado da API");
      return resposta.data;
    }
    qrcode.generate(qrText, { small: true });
    return resposta.data;
  } catch (erro) {
    console.log("Erro na requisição", erro);
  }
};

const verifyInstance = async (nome) => {
  try {
    const resposta = await evolution.get(`/instance/connectionState/${nome}`);
    const state = resposta.data.instance.state;
    console.log(state);
    return resposta.data;
  } catch (erro) {
    console.log("Erro na requisição", erro);
  }
};

const desconectInstance = async (nome) => {
  try {
    const logout = await evolution.delete(`/instance/logout/${nome}`);
    console.log(logout);
  } catch (erro) {
    console.error("Erro na requisição", erro);
  }
};

const deletetInstance = async (nome) => {
  try {
    const deleter = await evolution.delete(`/instance/delete/${nome}`);
    console.log(deleter);
  } catch (erro) {
    console.error("Erro na requisição", erro);
  }
};

module.exports = {
  evolution,
  createInstance,
  conectInstance,
  verifyInstance,
  desconectInstance,
  deletetInstance
};