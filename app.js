#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { program } from "commander";
import clipboardy from "clipboardy";
import { tokenize } from "./tokenizer.js";
import { processDirectoryOrPaths } from "./fileProcessor.js";
import { formatOutput } from "./outputFormatter.js";
import { filterFiles } from "./fileFilter.js";

const TOKENIZER_OPTIONS = Object.freeze({
  "Xenova/gpt-4": "gpt-4 / gpt-3.5-turbo / text-embedding-ada-002",
  "Xenova/text-davinci-003": "text-davinci-003 / text-davinci-002",
  "Xenova/gpt-3": "gpt-3",
  "Xenova/grok-1-tokenizer": "Grok-1",
  "Xenova/claude-tokenizer": "Claude",
  "Xenova/mistral-tokenizer-v3": "Mistral v3",
  "Xenova/mistral-tokenizer-v1": "Mistral v1",
  "Xenova/gemma-tokenizer": "Gemma",
  "Xenova/llama-3-tokenizer": "Llama 3",
  "Xenova/llama-tokenizer": "LLaMA / Llama 2",
  "Xenova/c4ai-command-r-v01-tokenizer": "Cohere Command-R",
  "Xenova/t5-small": "T5",
  "Xenova/bert-base-cased": "bert-base-cased",
});

program
  .version("0.1.0")
  .arguments("[paths...]")
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
  .option("-t, --tokenizer <model>", "Tokenizer model to use", "Xenova/gpt-4")
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
  .parse(process.argv);

const options = program.opts();
const paths = program.args.length > 0 ? program.args : [process.cwd()];

function printFileStructure(files) {
  const structure = {};
  files.forEach((file) => {
    const parts = file.path.split(path.sep);
    let current = structure;
    parts.forEach((part, index) => {
      if (!current[part]) {
        current[part] = index === parts.length - 1 ? null : {};
      }
      current = current[part];
    });
  });

  function printStructure(obj, indent = "") {
    Object.keys(obj).forEach((key, index, array) => {
      const isLast = index === array.length - 1;
      console.log(`${indent}${isLast ? "└── " : "├── "}${key}`);
      if (obj[key]) {
        printStructure(obj[key], `${indent}${isLast ? "    " : "│   "}`);
      }
    });
  }

  console.log("File structure:");
  printStructure(structure);
  console.log();
}

async function main() {
  try {
    const files = await processDirectoryOrPaths(paths, {
      extensions: options.extensions ? options.extensions.split(",") : null,
      ignorePatterns: options.ignore ? options.ignore.split(",") : null,
      includeDotFiles: options.includeDotFiles
        ? options.includeDotFiles.split(",")
        : [],
    });

    console.log("File structure before filtering:");
    printFileStructure(files);

    let totalTokens = 0;

    // Tokenize files
    for (const file of files) {
      try {
        const result = await tokenize(file.content, options.tokenizer);
        file.tokenCount = result.tokenCount;
        totalTokens += result.tokenCount;
      } catch (error) {
        console.error(`Error tokenizing file ${file.path}: ${error.message}`);
        file.tokenCount = 0;
      }
    }

    console.log(`\nTotal tokens before filtering: ${totalTokens}`);

    // Apply filtering
    const { filteredFiles, removedFiles, detectedLanguage } = filterFiles(
      files,
      {
        disableLanguageFilter: options.disableLanguageFilter,
        disableConfigFilter: options.disableConfigFilter,
        disableTokenFilter: options.disableTokenFilter,
      },
    );

    console.log(`\nDetected language: ${detectedLanguage}`);

    if (
      !options.disableLanguageFilter &&
      removedFiles.languageSpecific.length > 0
    ) {
      console.log("\nFiles removed by language-specific filter:");
      removedFiles.languageSpecific.forEach((file) => {
        console.log(`- ${file.path} (${file.tokenCount} tokens)`);
      });
    }

    if (
      !options.disableConfigFilter &&
      removedFiles.configurationFiles.length > 0
    ) {
      console.log("\nConfiguration files removed:");
      removedFiles.configurationFiles.forEach((file) => {
        console.log(`- ${file.path} (${file.tokenCount} tokens)`);
      });
    }

    if (!options.disableTokenFilter) {
      if (removedFiles.tokenAnomaly.length > 0) {
        console.log("\nFiles removed due to token count anomaly:");
        removedFiles.tokenAnomaly.forEach((file) => {
          console.log(`- ${file.path} (${file.tokenCount} tokens)`);
        });
      } else if (totalTokens > 50000) {
        console.log(
          "\nNo files were removed by token count anomaly filter, despite total tokens exceeding threshold.",
        );
      } else {
        console.log(
          "\nToken count anomaly filter was not applied due to low total token count.",
        );
      }
    }

    console.log("\nIncluded files after filtering:");
    filteredFiles.forEach((file) => {
      console.log(`- ${file.path} (${file.tokenCount} tokens)`);
    });

    const filteredTotalTokens = filteredFiles.reduce(
      (sum, file) => sum + file.tokenCount,
      0,
    );

    // Generate formatted output for all filtered files at once
    const formattedOutput = formatOutput(filteredFiles, options.format);

    // Calculate token overhead from formatting
    let formattedTokenCount;
    try {
      const formattedTokenResult = await tokenize(
        formattedOutput,
        options.tokenizer,
      );
      formattedTokenCount = formattedTokenResult.tokenCount;
    } catch (error) {
      console.error(`Error tokenizing formatted output: ${error.message}`);
      formattedTokenCount = filteredTotalTokens; // Fallback to avoid negative overhead
    }

    const tokenOverhead = formattedTokenCount - filteredTotalTokens;

    console.log(
      `\n${formattedTokenCount} tokens total, including ${tokenOverhead} from ${options.format} formatting.`,
    );

    // Copy formatted output to clipboard
    clipboardy.writeSync(formattedOutput);
    console.log("Formatted output has been copied to the clipboard.");
  } catch (error) {
    console.error("An error occurred:", error.message);
  }
}

main();
