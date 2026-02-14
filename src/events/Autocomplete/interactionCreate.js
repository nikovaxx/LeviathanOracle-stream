module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isAutocomplete?.()) return;

    const command = interaction.client.commands?.get(interaction.commandName);
    if (!command?.autocomplete) return;

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(`Autocomplete error for ${interaction.commandName}:`, error);
    }
  }
};
