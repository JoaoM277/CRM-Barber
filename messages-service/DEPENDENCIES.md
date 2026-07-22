# Dependências para rodar o serviço `messages-service`

Este arquivo descreve tudo o que é necessário para executar a pasta `messages-service` em qualquer máquina, sem modificar o código.

## Requisitos de ambiente

- Node.js 18 ou superior
- npm (gerenciador de pacotes do Node)

> A dependência `express@5.2.1` e alguns pacotes auxiliares exigem Node.js 18+.

## Instalação

No diretório `messages-service`, execute:

```bash
npm install
```

Se quiser usar as versões travadas no `package-lock.json`:

```bash
npm ci
```

## Dependências do projeto

As dependências diretas necessárias para executar o serviço são:

- `express@^5.2.1`
- `cors@^2.8.6`
- `dotenv@^17.4.2`
- `zod@^4.4.3`

Dependência de desenvolvimento usada para facilitar o desenvolvimento local:

- `nodemon@^3.1.14`

## Uso

- `npm start` — inicia o servidor com Node
- `npm run dev` — inicia o servidor com `nodemon`

## Variáveis de ambiente necessárias

O serviço usa `dotenv` para carregar variáveis de ambiente a partir de `.env`.

As variáveis esperadas são:

- `INFOBIP_BASE_URL`
- `INFOBIP_API_KEY`
- `INFOBIP_SENDER_ID`
- `INFOBIP_WHATSAPP_NUMBER`

Opcionalmente, para definir a porta do servidor:

- `PORT`

## Observações

- O arquivo `package-lock.json` já contém as versões travadas dos pacotes transitivos.
- Não é necessário modificar nenhum código para usar este serviço.
