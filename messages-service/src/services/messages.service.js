const messageService = (number, name, text) => {

  const messageRespost = "Ola " + name + " o seu numero é " + number + " Voce disse "+text+".";

  return messageRespost;
};

module.exports = { messageService };
