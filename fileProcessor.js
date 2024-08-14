import fs from "fs/promises";
import path from "path";
import ignore from "ignore";
import { execSync } from "child_process";

const DEFAULT_IGNORE_PATTERNS = [
  ".git",
  ".svn",
  ".hg",
  ".bzr",
  "CVS",
  ".gitignore",
  ".gitattributes",
  ".gitmodules",
  "node_modules",
  "LICENSE",
];

function isTextFile(filePath) {
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
    console.warn(
      `Warning: Unable to determine file type for ${filePath}. Assuming it's not a text file.`,
    );
    return false;
  }
}

export async function processDirectoryOrPaths(paths, options) {
  const files = [];
  const ig = ignore();

  // Add default ignore patterns
  ig.add(DEFAULT_IGNORE_PATTERNS);

  // Ignore all dot files and directories by default
  ig.add(".*");

  // Add user-specified ignore patterns
  if (options.ignorePatterns) {
    ig.add(options.ignorePatterns);
  }

  // Add user-specified dot files/directories to include
  if (options.includeDotFiles) {
    options.includeDotFiles.forEach((pattern) => {
      ig.add(`!${pattern}`);
    });
  }

  for (const itemPath of paths) {
    const stat = await fs.stat(itemPath);

    if (stat.isDirectory()) {
      // Read .gitignore file if it exists in the directory
      try {
        const gitignorePath = path.join(itemPath, ".gitignore");
        const gitignoreContent = await fs.readFile(gitignorePath, "utf-8");
        ig.add(gitignoreContent);
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.warn(
            `Warning: Error reading .gitignore file in ${itemPath}: ${error.message}`,
          );
        }
      }

      await traverseDirectory(itemPath, itemPath, files, ig, options);
    } else if (stat.isFile()) {
      await processFile(itemPath, files, options);
    }
  }

  return files;
}

async function traverseDirectory(baseDir, currentDir, files, ig, options) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (ig.ignores(relativePath)) continue;

    if (entry.isDirectory()) {
      await traverseDirectory(baseDir, fullPath, files, ig, options);
    } else if (entry.isFile()) {
      await processFile(fullPath, files, options);
    }
  }
}

async function processFile(filePath, files, options) {
  if (
    options.extensions &&
    !options.extensions.includes(path.extname(filePath).slice(1))
  ) {
    return;
  }

  if (!isTextFile(filePath)) {
    console.log(`Skipping non-text file: ${filePath}`);
    return;
  }

  const content = await fs.readFile(filePath, "utf-8");
  files.push({ path: filePath, content });
}
