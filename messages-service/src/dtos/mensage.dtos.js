const { z } = require("zod");

const messageCreateSchema = z.object({
  number: z
    .string()
    .min(11, "O numero deve ter no minimo 11 digitos")
    .max(13, "O numero deve ter no maximo 13 digitos"),
  name: z.string().min(1, "Nome invalido"),
  type: z.string().min(1, "Tipo de mensagem invalido"),
});

const makeMessageDTO = (data) => {
  return messageCreateSchema.parse(data);
};

module.exports = { messageCreateSchema, makeMessageDTO };
