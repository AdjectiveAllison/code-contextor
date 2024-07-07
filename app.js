#!/usr/bin/env node
import { program } from "commander";
import { runCLI } from "./cli.js";
import { runTUI } from "./tui.js";
import { loadConfig } from "./utils/config.js";
import { logger, LOG_LEVELS } from "./utils/logger.js";

async function main() {
  try {
    program
      .version("0.1.0")
      .option("-d, --directory <path>", "Target directory", process.cwd())
      .option(
        "-e, --extensions <extensions>",
        "File extensions to include (comma-separated)",
      )
      .option(
        "-i, --ignore <patterns>",
        "Additional patterns to ignore (comma-separated)",
      )
      .option("-m, --max-tokens <number>", "Maximum number of tokens", parseInt)
      .option(
        "-f, --format <format>",
        "Output format (xml, json, codeblocks)",
        "xml",
      )
      .option(
        "-t, --tokenizer <model>",
        "Tokenizer model to use",
        "Xenova/gpt-4",
      )
      .option(
        "-o, --output <file>",
        "Output file for formatted content",
        "output.txt",
      )
      .option(
        "--disable-language-filter",
        "Disable language-specific file filtering",
      )
      .option("--disable-config-filter", "Disable configuration file filtering")
      .option("--disable-token-filter", "Disable token count anomaly filtering")
      .option(
        "--include-dot-files <patterns>",
        "Dot files/directories to include (comma-separated)",
      )
      .option("--non-interactive", "Run in non-interactive mode")
      .option(
        "--log-level <level>",
        "Set log level (ERROR, WARN, INFO, DEBUG)",
        "INFO",
      )
      .parse(process.argv);

    const options = program.opts();
    const config = loadConfig(options);

    // Set log level based on command line option
    logger.setLogLevel(options.logLevel);

    logger.info("Code Contextor starting...");
    logger.info(
      `Mode: ${config.nonInteractive ? "Non-interactive (CLI)" : "Interactive (TUI)"}`,
    );
    logger.info(`Target directory: ${config.directory}`);

    if (config.nonInteractive) {
      await runCLI(config);
    } else {
      logger.info("Starting TUI mode...");
      await runTUI(config);
      // The following line will never be reached in TUI mode
      logger.info("TUI mode ended.");
    }

    // This line will only be reached in non-interactive mode
    logger.info("Code Contextor finished successfully");
  } catch (error) {
    logger.error("An error occurred:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error("Unhandled error:", error.message);
  console.error(error.stack);
  process.exit(1);
});
