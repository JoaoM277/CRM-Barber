const { z } = require("zod");

const messageCreateSchema = z.object({
  phone: z
    .string()
    .min(11, "O numero deve ter no minimo 11 digitos")
    .max(13, "O numero deve ter no maximo 13 digitos"),
  name: z.string().min(1, "Nome invalido"),
  trigger: z.enum(["AGENDAMENTO", "CANCELAMENTO", "LEMBRETE"], {
    errorMap: () => ({ message: "Gatilho de evento Invalido" }),
  }),
  appointmentData: z
    .object({
      date: z.string().optional(),
      time: z.string().optional(),
      barber: z.string().optional(),
    })
    .optional(),
});

const makeMessageDTO = (data) => {
  return messageCreateSchema.parse(data);
};

module.exports = { messageCreateSchema, makeMessageDTO };
