module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    const isAutocomplete = (interaction.isAutocomplete && interaction.isAutocomplete());
    if (isAutocomplete) {
      const client = interaction.client;
      const command = client.commands?.get(interaction.commandName);
      if (!command || !command.autocomplete) return;

      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error(`Autocomplete error for ${interaction.commandName}:`, error);
      }
    }
  }
};
