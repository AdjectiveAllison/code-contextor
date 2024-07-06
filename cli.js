import { processFiles } from "./core/fileProcessor.js";
import { tokenizeFiles } from "./core/tokenizer.js";
import { applyFilters } from "./core/filter.js";
import { formatOutput } from "./core/formatter.js";
import { logger } from "./utils/logger.js";
import fs from "fs/promises";
import path from "path";

export async function runCLI(config) {
  try {
    logger.info("Starting CLI mode");
    logger.info(`Processing directory: ${config.directory}`);

    // Process files
    const files = await processFiles(config.directory, config);
    logger.info(
      `Found ${countFiles(files)} files in ${countDirectories(files)} directories`,
    );

    // Display file structure
    logger.info("File structure before filtering:");
    displayFileStructure(files);

    // Tokenize files
    logger.info("Tokenizing files...");
    const tokenizedFiles = await tokenizeFiles(files, config.tokenizer);
    const totalTokens = calculateTotalTokens(tokenizedFiles);
    logger.info(`Total tokens before filtering: ${totalTokens}`);

    // Apply filters
    logger.info("Applying filters...");
    const { filteredFiles, removedFiles, detectedLanguage } = applyFilters(
      tokenizedFiles,
      config,
    );

    // Display filtering results
    displayFilteringResults(removedFiles, detectedLanguage, config);

    // Display included files after filtering
    logger.info("Included files after filtering:");
    displayIncludedFiles(filteredFiles);

    // Calculate and display total tokens after filtering
    const filteredTotalTokens = calculateTotalTokens(filteredFiles);
    logger.info(`Total tokens after filtering: ${filteredTotalTokens}`);

    // Format output
    const formattedOutput = formatOutput(filteredFiles, config.format);

    // Write formatted output to file
    const outputPath = path.resolve(config.output);
    await fs.writeFile(outputPath, formattedOutput);
    logger.info(`Formatted output written to: ${outputPath}`);

    // Display equivalent command
    const command = generateEquivalentCommand(config);
    logger.info("Equivalent command:");
    console.log(command);
  } catch (error) {
    logger.error("An error occurred:", error.message);
    console.error(error.stack);
  }
}

function countFiles(files) {
  return files.reduce((count, file) => {
    if (file.isDirectory) {
      return count + countFiles(file.children);
    }
    return count + 1;
  }, 0);
}

function countDirectories(files) {
  return files.reduce((count, file) => {
    if (file.isDirectory) {
      return count + 1 + countDirectories(file.children);
    }
    return count;
  }, 0);
}

function displayFileStructure(files, indent = "") {
  files.forEach((file) => {
    console.log(`${indent}${file.isDirectory ? "📁" : "📄"} ${file.path}`);
    if (file.isDirectory) {
      displayFileStructure(file.children, indent + "  ");
    }
  });
}

function calculateTotalTokens(files) {
  return files.reduce((total, file) => {
    if (file.isDirectory) {
      return total + calculateTotalTokens(file.children);
    }
    return total + (file.tokenCount || 0);
  }, 0);
}

function displayFilteringResults(removedFiles, detectedLanguage, config) {
  logger.info(`Detected language: ${detectedLanguage}`);

  if (
    !config.disableLanguageFilter &&
    removedFiles.languageSpecific.length > 0
  ) {
    logger.info("\nFiles removed by language-specific filter:");
    removedFiles.languageSpecific.forEach((file) => {
      logger.info(`- ${file.path} (${file.tokenCount} tokens)`);
    });
  }

  if (
    !config.disableConfigFilter &&
    removedFiles.configurationFiles.length > 0
  ) {
    logger.info("\nConfiguration files removed:");
    removedFiles.configurationFiles.forEach((file) => {
      logger.info(`- ${file.path} (${file.tokenCount} tokens)`);
    });
  }

  if (!config.disableTokenFilter) {
    if (removedFiles.tokenAnomaly.length > 0) {
      logger.info("\nFiles removed due to token count anomaly:");
      removedFiles.tokenAnomaly.forEach((file) => {
        logger.info(`- ${file.path} (${file.tokenCount} tokens)`);
      });
    } else {
      logger.info("\nNo files were removed by token count anomaly filter.");
    }
  }
}

function displayIncludedFiles(files, indent = "") {
  files.forEach((file) => {
    if (file.isDirectory) {
      logger.info(`${indent}📁 ${file.path} (${file.tokenCount} tokens)`);
      displayIncludedFiles(file.children, indent + "  ");
    } else {
      logger.info(`${indent}📄 ${file.path} (${file.tokenCount} tokens)`);
    }
  });
}

function generateEquivalentCommand(config) {
  let command = `node app.js --non-interactive --directory "${config.directory}"`;

  if (config.extensions)
    command += ` --extensions ${config.extensions.join(",")}`;
  if (config.ignorePatterns)
    command += ` --ignore ${config.ignorePatterns.join(",")}`;
  if (config.maxTokens !== Infinity)
    command += ` --max-tokens ${config.maxTokens}`;
  if (config.format !== "xml") command += ` --format ${config.format}`;
  if (config.tokenizer !== "Xenova/gpt-4")
    command += ` --tokenizer ${config.tokenizer}`;
  if (config.output !== "output.txt") command += ` --output ${config.output}`;
  if (config.disableLanguageFilter) command += " --disable-language-filter";
  if (config.disableConfigFilter) command += " --disable-config-filter";
  if (config.disableTokenFilter) command += " --disable-token-filter";
  if (config.includeDotFiles.length > 0)
    command += ` --include-dot-files ${config.includeDotFiles.join(",")}`;

  return command;
}
