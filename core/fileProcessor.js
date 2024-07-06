import fs from "fs/promises";
import path from "path";
import ignore from "ignore";
import { logger } from "../utils/logger.js";

export async function processFiles(directory, config) {
  // Initialize ignore patterns
  // Traverse directory
  // Filter files based on configuration
  // Return array of file objects { path, content, isDirectory, children? }
}

export function isTextFile(filePath) {
  // Determine if a file is a text file
}
