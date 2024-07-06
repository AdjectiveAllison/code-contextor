import { AutoTokenizer } from "@xenova/transformers";
import { logger } from "../utils/logger.js";

const tokenizerCache = new Map();

export async function tokenizeFiles(files, model) {
  logger.info(`Tokenizing files using model: ${model}`);
  return await tokenizeFilesRecursive(files, model);
}

async function tokenizeFilesRecursive(files, model) {
  const tokenizedFiles = [];

  for (const file of files) {
    if (file.isDirectory) {
      const tokenizedChildren = await tokenizeFilesRecursive(
        file.children,
        model,
      );
      const dirTokenCount = tokenizedChildren.reduce(
        (sum, child) => sum + (child.tokenCount || 0),
        0,
      );
      tokenizedFiles.push({
        ...file,
        children: tokenizedChildren,
        tokenCount: dirTokenCount,
      });
    } else {
      try {
        const result = await tokenize(file.content, model);
        tokenizedFiles.push({
          ...file,
          tokenCount: result.tokenCount,
          tokens: result.tokens, // Optional: include actual tokens if needed
        });
      } catch (error) {
        logger.error(`Error tokenizing file ${file.path}: ${error.message}`);
        tokenizedFiles.push({
          ...file,
          tokenCount: 0,
          tokenizationError: error.message,
        });
      }
    }
  }

  return tokenizedFiles;
}

async function tokenize(text, model) {
  try {
    if (!tokenizerCache.has(model)) {
      logger.info(`Loading tokenizer for model: ${model}`);
      const tokenizer = await AutoTokenizer.from_pretrained(model);
      tokenizerCache.set(model, tokenizer);
    }

    const tokenizer = tokenizerCache.get(model);
    const encodedOutput = tokenizer.encode(text);

    if (!Array.isArray(encodedOutput)) {
      throw new Error(
        `Unexpected encoded output type: ${typeof encodedOutput}`,
      );
    }

    return {
      tokenIds: encodedOutput,
      tokens: encodedOutput.map((id) => tokenizer.decode([id])),
      tokenCount: encodedOutput.length,
    };
  } catch (error) {
    logger.error(`Error tokenizing with model ${model}: ${error.message}`);
    throw error;
  }
}

export async function getTokenizerInfo(model) {
  try {
    if (!tokenizerCache.has(model)) {
      logger.info(`Loading tokenizer for model: ${model}`);
      const tokenizer = await AutoTokenizer.from_pretrained(model);
      tokenizerCache.set(model, tokenizer);
    }

    const tokenizer = tokenizerCache.get(model);
    return {
      vocabularySize: tokenizer.vocab_size,
      modelType: tokenizer.model_type,
      // Add any other relevant tokenizer information here
    };
  } catch (error) {
    logger.error(
      `Error getting tokenizer info for model ${model}: ${error.message}`,
    );
    throw error;
  }
}
