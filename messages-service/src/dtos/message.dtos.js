const { z } = require("zod");
const { required } = require("zod/mini");

// --------------------------------------------------------------------------
// 1. Corpo de Validação de dados vinjdos do CRM
// --------------------------------------------------------------------------

const messageCreateSchema = z.object({
  phone: z
    .string()
    .min(11, "O numero deve ter no minimo 11 digitos")
    .max(20, "O numero deve ter no maximo 13 digitos"),
  name: z.string().min(1, "Nome invalido"),
  trigger: z.enum(["AGENDAMENTO", "CANCELAMENTO", "LEMBRETE"], {
    errorMap: () => ({ message: "Gatilho de evento Invalido" }),
  }),
  date: z.string().optional(),
  time: z.string().optional(),
  barber: z.string().optional(),
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

const makeMessageDTO = (data) => {
  return messageCreateSchema.safeParse(data);
};

module.exports = { makeMessageDTO, makeSchemaEvolution };
