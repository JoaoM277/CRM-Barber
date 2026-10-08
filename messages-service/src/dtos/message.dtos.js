const { z } = require("zod");

// --------------------------------------------------------------------------
// 1. Corpo de Validação de dados vinjdos do CRM
// --------------------------------------------------------------------------

const messageCreateSchema = z.object({
  phone: z
    .string()
    .min(11, "O numero deve ter no minimo 11 digitos")
    .max(20, "O numero deve ter no maximo 13 digitos"),
  name: z.string().min(1, "Nome invalido"),
  trigger: z.enum(["AGENDAMENTO", "CANCELAMENTO", "LEMBRETE", "LEMBRETE_24H", "LEMBRETE_2H", "RESPOSTA_CONFIRMADO", "RESPOSTA_CANCELADO", "REMARCADO", "REATIVACAO"], {
    errorMap: () => ({ message: "Gatilho de evento Invalido" }),
  }),
  // nullish(): o Laravel pode mandar null nesses campos (ex.: barbeiro removido)
  date: z.string().nullish(),
  time: z.string().nullish(),
  barber: z.string().nullish(),
  services: z.array(z.string()).nullish(),
  instance: z.string().nullish(),
  // cliente do CRM (o registro da mensagem fica no cliente certo)
  client_id: z.number().int().positive().nullish(),
  barbershop: z.string().nullish(),
  // lembrete pede "1 confirma / 2 cancela" só se o cliente ainda não confirmou
  ask_reply: z.boolean().nullish(),
  // a barbearia permite cancelar respondendo "2" ao lembrete?
  allow_cancel: z.boolean().nullish(),
  // link da página de agendamento (aviso de cancelamento)
  link: z.string().url().nullish(),
  // link "meu horário" para o cliente cancelar/remarcar
  manage_link: z.string().url().nullish(),
});

const schemaWebhook = z.object({
  name: z.string().trim().min(1),
  url: z.string().url(),
});

const schemaEvolution = z.object({
  name: z
    .string({ required_error: "O campo name é obrigatorio" })
    .trim()
    .min(1, { message: "O campo não pode ser vazio" }),
});

const makeSchemaEvolution = (data) => {
  return schemaEvolution.safeParse(data);
};

const makeWebhookDTO = (data) => schemaWebhook.safeParse(data);

const makeMessageDTO = (data) => {
  return messageCreateSchema.safeParse(data);
};

module.exports = { makeMessageDTO, makeSchemaEvolution, makeWebhookDTO };
