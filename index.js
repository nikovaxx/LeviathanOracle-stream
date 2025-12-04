import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, ActivityType, REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { pathToFileURL } from 'url';
import chalk from 'chalk';
import { initializeDatabase, cleanup, waitForDatabaseConnections } from './database/dbmanager.js';
import { loadError, errorHandler } from './utils/errorHandler.js';
import { initializeScheduler } from './utils/schedulers/notificationScheduler.js';

// Initialize error handler first
loadError();

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

client.commands = new Collection();

// Load and register commands
async function loadCommands() {
  try {
    console.log(
      chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
      chalk.white('[') + chalk.blue('INFO') + chalk.white('] ') +
      chalk.blue('Loading commands...')
    );

    const commandFiles = readdirSync('./commands').filter(file => file.endsWith('.js'));
    const commandsData = [];
    let loadedCount = 0;

    for (const file of commandFiles) {
      try {
        const fileURL = pathToFileURL(`./commands/${file}`).href;
        const commandModule = await import(fileURL);
        const command = commandModule.default;
        
        if (command?.data?.name) {
          client.commands.set(command.data.name, command);
          commandsData.push(command.data.toJSON());
          loadedCount++;
        }
      } catch (err) {
        errorHandler(err, `Failed to load command ${file}`);
      }
    }

    console.log(
      chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
      chalk.white('[') + chalk.green('INFO') + chalk.white('] ') +
      chalk.green(`✓ Loaded ${loadedCount} commands`)
    );

    // Register commands with Discord
    if (commandsData.length > 0 && process.env.DISCORD_BOT_ID) {
      console.log(
        chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
        chalk.white('[') + chalk.blue('INFO') + chalk.white('] ') +
        chalk.blue('Registering slash commands with Discord...')
      );

      const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);

      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_BOT_ID),
        { body: commandsData }
      );

      console.log(
        chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
        chalk.white('[') + chalk.green('INFO') + chalk.white('] ') +
        chalk.green(`✓ Registered ${commandsData.length} slash commands with Discord`)
      );
    }
  } catch (err) {
    errorHandler(err, 'Error loading/registering commands');
  }
}

// Bot ready event
client.once('ready', async () => {
  try {
    console.log(
      chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
      chalk.white('[') + chalk.green('INFO') + chalk.white('] ') +
      chalk.green(`Logged in as ${client.user.tag}`)
    );

    // Set bot presence
    client.user.setPresence({
      status: 'online',
      activities: [{
        name: 'Your Anime Notifications',
        type: ActivityType.Watching,
      }],
    });

    // Wait for database connections
    console.log(
      chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
      chalk.white('[') + chalk.blue('INFO') + chalk.white('] ') +
      chalk.blue('Waiting for database connections...')
    );
    await waitForDatabaseConnections();

    // Initialize database tables
    await initializeDatabase();

    // Load and register commands
    await loadCommands();

    // Initialize notification scheduler
    initializeScheduler(client);

    console.log(
      chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
      chalk.white('[') + chalk.green('INFO') + chalk.white('] ') +
      chalk.green.bold('✓ Bot is fully operational!')
    );
  } catch (err) {
    errorHandler(err, 'Bot initialization');
    console.error(chalk.red('✗ Error during bot initialization'));
    process.exit(1);
  }
});

// Handle interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName.toLowerCase());
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    errorHandler(err, `Error executing ${interaction.commandName}:`);
    
    const errorMessage = { content: 'An error occurred while executing this command.', ephemeral: true };
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(errorMessage).catch(() => {});
    } else {
      await interaction.followUp(errorMessage).catch(() => {});
    }
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log(
    chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
    chalk.white('[') + chalk.yellow('INFO') + chalk.white('] ') +
    chalk.yellow('Shutting down...')
  );
  
  await cleanup();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(
    chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
    chalk.white('[') + chalk.yellow('INFO') + chalk.white('] ') +
    chalk.yellow('Shutting down gracefully...')
  );
  
  await cleanup();
  client.destroy();
  process.exit(0);
});

// Login
console.log(
  chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
  chalk.white('[') + chalk.blue('INFO') + chalk.white('] ') +
  chalk.blue('Attempting bot login...')
);

client.login(process.env.DISCORD_BOT_TOKEN)
  .catch(e => {
    errorHandler(e, 'Bot login');
    console.error(chalk.red('✗ Bot login failed'));
    process.exit(1);
  });