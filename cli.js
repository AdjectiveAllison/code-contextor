import { processFiles } from "./core/fileProcessor.js";
import { applyFilters } from "./core/filter.js";
import { tokenizeFiles } from "./core/tokenizer.js";
import { formatOutput } from "./core/formatter.js";
import { logger } from "./utils/logger.js";

export async function runCLI(config) {
  // Process files
  const files = await processFiles(config.directory, config);
  logger.info("File processing complete");

  // Tokenize files
  const tokenizedFiles = await tokenizeFiles(files, config.tokenizer);
  logger.info("Tokenization complete");

  // Apply filters
  const filteredFiles = applyFilters(tokenizedFiles, config);
  logger.info("Filtering complete");

  // Format and output results
  const output = formatOutput(filteredFiles, config.format);
  // Write output to file or console
  logger.info("Output generated");
}
