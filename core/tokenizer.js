import { AutoTokenizer } from "@xenova/transformers";
import { logger } from "../utils/logger.js";

const tokenizerCache = new Map();

export async function tokenizeFiles(files, model) {
  // Tokenize each file
  // Return array of file objects with token counts added
}

async function tokenize(text, model) {
  // Tokenize individual text
  // Return token count and other relevant information
}
