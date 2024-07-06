import fs from "fs/promises";
import path from "path";
import ignore from "ignore";
import { execSync } from "child_process";
import { logger } from "../utils/logger.js";
import { DEFAULT_IGNORE_PATTERNS } from "../utils/config.js";

export async function processFiles(directory, config) {
  logger.info(`Processing directory: ${directory}`);
  const ig = ignore();

  // Add default ignore patterns
  ig.add(DEFAULT_IGNORE_PATTERNS);

  // Ignore all dot files and directories by default
  ig.add(".*");

  // Add the output file to ignore patterns
  if (config.outputFile) {
    ig.add(path.relative(directory, config.outputFile));
  }

  // Read .gitignore file if it exists
  try {
    const gitignorePath = path.join(directory, ".gitignore");
    const gitignoreContent = await fs.readFile(gitignorePath, "utf-8");
    ig.add(gitignoreContent);
  } catch (error) {
    if (error.code !== "ENOENT") {
      logger.warn(`Error reading .gitignore file: ${error.message}`);
    }
  }

  // Add user-specified ignore patterns
  if (config.ignorePatterns) {
    ig.add(config.ignorePatterns);
  }

  // Add user-specified dot files/directories to include
  if (config.includeDotFiles) {
    config.includeDotFiles.forEach((pattern) => {
      ig.add(`!${pattern}`);
    });
  }

  return await traverseDirectory(directory, directory, ig, config);
}

async function traverseDirectory(baseDir, currentDir, ig, config) {
  logger.debug(`Traversing directory: ${currentDir}`);
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (ig.ignores(relativePath)) {
      logger.debug(`Ignoring: ${relativePath}`);
      continue;
    }

    if (entry.isDirectory()) {
      logger.debug(`Found directory: ${relativePath}`);
      const children = await traverseDirectory(baseDir, fullPath, ig, config);
      if (children.length > 0) {
        result.push({
          path: relativePath,
          isDirectory: true,
          children: children,
        });
      }
    } else if (entry.isFile()) {
      if (
        config.extensions &&
        !config.extensions.includes(path.extname(entry.name).slice(1))
      ) {
        logger.debug(`Skipping file due to extension: ${relativePath}`);
        continue;
      }

      if (!isTextFile(fullPath)) {
        logger.debug(`Skipping non-text file: ${relativePath}`);
        continue;
      }

      logger.debug(`Processing file: ${relativePath}`);
      const content = await fs.readFile(fullPath, "utf-8");
      result.push({
        path: relativePath,
        isDirectory: false,
        content: content,
      });
    }
  }

  return result;
}

export function isTextFile(filePath) {
  try {
    // Use the 'file' command to determine file type
    const output = execSync(`file -b --mime-type "${filePath}"`, {
      encoding: "utf-8",
    }).trim();

    // List of MIME types we consider as text
    const textMimeTypes = [
      "text/",
      "application/json",
      "application/xml",
      "application/javascript",
      "application/x-python-code",
      "application/x-empty",
    ];

    // Check if the file's MIME type starts with any of the text MIME types
    if (textMimeTypes.some((type) => output.startsWith(type))) {
      return true;
    }

    // For files that might be misidentified, check the extension
    const textExtensions = [
      ".js",
      ".py",
      ".json",
      ".ndjson",
      ".md",
      ".txt",
      ".html",
      ".css",
      ".yml",
      ".yaml",
    ];
    if (textExtensions.includes(path.extname(filePath).toLowerCase())) {
      return true;
    }

    // If still not identified as text, try to read the first few bytes
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(1024);
    const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
    fs.closeSync(fd);

    // Check if the file contains only printable ASCII characters and common whitespace
    for (let i = 0; i < bytesRead; i++) {
      const byte = buffer[i];
      if ((byte < 32 || byte > 126) && ![9, 10, 13].includes(byte)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.warn(
      `Unable to determine file type for ${filePath}. Assuming it's not a text file.`,
    );
    return false;
  }
}
