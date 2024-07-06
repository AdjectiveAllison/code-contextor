import path from "path";
import { logger } from "./logger.js";

export const DEFAULT_IGNORE_PATTERNS = [
  ".git",
  ".svn",
  ".hg",
  ".bzr",
  "CVS",
  ".gitignore",
  ".gitattributes",
  ".gitmodules",
  "node_modules",
];

export const TOKENIZER_OPTIONS = Object.freeze({
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

const DEFAULT_CONFIG = {
  directory: process.cwd(),
  extensions: null,
  ignorePatterns: null,
  maxTokens: Infinity,
  format: "xml",
  tokenizer: "Xenova/gpt-4",
  output: "output.txt",
  disableLanguageFilter: false,
  disableConfigFilter: false,
  disableTokenFilter: false,
  includeDotFiles: [],
  nonInteractive: false,
};

export function loadConfig(options) {
  logger.info("Loading configuration");
  const config = { ...DEFAULT_CONFIG, ...options };

  // Ensure the directory is an absolute path
  config.directory = path.resolve(config.directory);

  // Convert comma-separated strings to arrays
  if (typeof config.extensions === "string") {
    config.extensions = config.extensions.split(",").map((ext) => ext.trim());
  }
  if (typeof config.ignorePatterns === "string") {
    config.ignorePatterns = config.ignorePatterns
      .split(",")
      .map((pattern) => pattern.trim());
  }
  if (typeof config.includeDotFiles === "string") {
    config.includeDotFiles = config.includeDotFiles
      .split(",")
      .map((pattern) => pattern.trim());
  }

  // Validate tokenizer
  if (!TOKENIZER_OPTIONS[config.tokenizer]) {
    logger.warn(`Invalid tokenizer '${config.tokenizer}'. Using default.`);
    config.tokenizer = DEFAULT_CONFIG.tokenizer;
  }

  // Validate format
  const validFormats = ["xml", "json", "codeblocks"];
  if (!validFormats.includes(config.format)) {
    logger.warn(`Invalid format '${config.format}'. Using default.`);
    config.format = DEFAULT_CONFIG.format;
  }

  // Ensure maxTokens is a number
  config.maxTokens = Number(config.maxTokens) || Infinity;

  logger.info("Configuration loaded successfully");
  return config;
}

export function getTokenizerDescription(tokenizer) {
  return TOKENIZER_OPTIONS[tokenizer] || "Unknown tokenizer";
}
