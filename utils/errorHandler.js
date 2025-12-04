import chalk from 'chalk';
import { EmbedBuilder, WebhookClient } from "discord.js";

// Webhook credentials
const WEBHOOK_ID = "1411748789944844349"; // Webhook ID
const WEBHOOK_TOKEN = "SzUnPXh32AfszgKdeag5Eg6TrkSrEreuFspT5F3CyT_wehZKUv8KQv1nwXRkGVC3ciAd"; // Webhook Token

const wbc = new WebhookClient({ id: WEBHOOK_ID, token: WEBHOOK_TOKEN });

// Extract clean error message (no stack traces, just the error itself)
function extractCleanError(err) {
  if (!err) return "Unknown error";
  
  // Try to get the most specific error message
  if (typeof err === 'string') return err;
  if (err.sqlMessage) return err.sqlMessage; // MariaDB errors
  if (err.message) return err.message;
  
  return String(err).split('\n')[0]; // First line only
}

// Helper to create an embed for errors or logs
function createEmbed(title, content, color = "Orange") {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(`\`\`\`\n${content}\n\`\`\``)
    .setTimestamp();
}

// Unified function to send an embed to the webhook
function sendWebhook(title, content, color = "Red") {
  wbc.send({ embeds: [createEmbed(title, content, color)] }).catch(() => {});
}

// Handles any caught errors - logs full details to console, clean message to webhook
export function errorHandler(err, context = "Unknown") {
  console.log(chalk.red.dim("[AntiCrash] | [BotError_Logs] | [Start] : ==============="));
  console.log(`[ERROR] ${context}:`, err);
  console.log(chalk.red.dim("[AntiCrash] | [BotError_Logs] | [End] : ==============="));
  
  const cleanError = extractCleanError(err);
  sendWebhook("BOT_ERROR_LOGS", `${context}\nError: ${cleanError}`);
}

// Load anti-crash handlers
export function loadError() {
  console.log(
    chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
    chalk.white('[') + chalk.green('INFO') + chalk.white('] ') +
    chalk.green('Error Handler') + chalk.white(' Loaded!')
  );

  process.on("beforeExit", (code) => {
    console.log(chalk.red.dim("[AntiCrash] | [BeforeExit_Logs] | [Start] : ==============="));
    console.log(code);
    console.log(chalk.red("[AntiCrash] | [BeforeExit_Logs] | [End] : ==============="));
    sendWebhook("CONSOLE: BEFORE_EXIT_LOGS", `${code}`);
  });

  process.on("exit", (code) => {
    console.log(chalk.red("[AntiCrash] | [Exit_Logs] | [Start]  : ==============="));
    console.log(code);
    console.log(chalk.red("[AntiCrash] | [Exit_Logs] | [End] : ==============="));
    sendWebhook("CONSOLE: EXIT_LOGS", `${code}`);
  });

  process.on("unhandledRejection", (reason) => {
    console.log(chalk.red("[AntiCrash] | [UnhandledRejection_Logs] | [start] : ==============="));
    console.log(reason);
    console.log(chalk.red("[AntiCrash] | [UnhandledRejection_Logs] | [end] : ==============="));
    sendWebhook("CONSOLE: UNHANDLED_REJECTION_LOGS", `${reason}`);
  });

  process.on("rejectionHandled", (promise) => {
    console.log(chalk.red("[AntiCrash] | [RejectionHandled_Logs] | [Start] : ==============="));
    console.log(promise);
    console.log(chalk.red("[AntiCrash] | [RejectionHandled_Logs] | [End] : ==============="));
    sendWebhook("CONSOLE: REJECTION_HANDLED_LOGS", `${promise}`);
  });

  process.on("uncaughtException", (err, origin) => {
    console.log(chalk.red("[AntiCrash] | [UncaughtException_Logs] | [Start] : ==============="));
    console.log(err);
    console.log(chalk.red("[AntiCrash] | [UncaughtException_Logs] | [End] : ==============="));
    sendWebhook("CONSOLE: UNCAUGHT_EXCEPTION_LOGS", `${err}\nORIGIN: ${origin}`, "Red");
  });

  process.on("uncaughtExceptionMonitor", (err, origin) => {
    console.log(chalk.red("[AntiCrash] | [UncaughtExceptionMonitor_Logs] | [Start] : ==============="));
    console.log(err);
    console.log(chalk.red("[AntiCrash] | [UncaughtExceptionMonitor_Logs] | [End] : ==============="));
    sendWebhook("CONSOLE: UNCAUGHT_EXCEPTION_MONITOR_LOGS", `${err}\nORIGIN: ${origin}`, "Red");
  });

  process.on("warning", (warning) => {
    console.log(chalk.red("[AntiCrash] | [Warning_Logs] | [Start] : ==============="));
    console.log(warning);
    console.log(chalk.red("[AntiCrash] | [Warning_Logs] | [End] : ==============="));
    sendWebhook("CONSOLE: WARNING_LOGS", `${warning}`, "Yellow");
  });
}
