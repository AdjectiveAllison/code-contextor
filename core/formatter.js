import { logger } from "../utils/logger.js";

const AVAILABLE_FORMATS = ["xml", "json", "codeblocks"];

export function formatOutput(files, format) {
  logger.info(`Formatting output in ${format} format`);

  switch (format) {
    case "xml":
      return formatXml(files);
    case "json":
      return formatJson(files);
    case "codeblocks":
      return formatCodeblocks(files);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

export function getAvailableFormats() {
  return AVAILABLE_FORMATS;
}

function formatXml(files) {
  let output = '<?xml version="1.0" encoding="UTF-8"?>\n<files>\n';
  output += formatXmlRecursive(files, 1);
  output += "</files>";
  return output;
}

function formatXmlRecursive(files, indentLevel) {
  let output = "";
  const indent = "  ".repeat(indentLevel);

  files.forEach((file) => {
    if (file.isDirectory) {
      output += `${indent}<directory>\n`;
      output += `${indent}  <path>${escapeXml(file.path)}</path>\n`;
      output += formatXmlRecursive(file.children, indentLevel + 1);
      output += `${indent}</directory>\n`;
    } else {
      output += `${indent}<file>\n`;
      output += `${indent}  <path>${escapeXml(file.path)}</path>\n`;
      output += `${indent}  <content>${escapeXml(file.content)}</content>\n`;
      if (file.tokenCount !== undefined) {
        output += `${indent}  <tokenCount>${file.tokenCount}</tokenCount>\n`;
      }
      output += `${indent}</file>\n`;
    }
  });

  return output;
}

function formatJson(files) {
  return JSON.stringify(files, null, 2);
}

function formatCodeblocks(files) {
  return formatCodeblocksRecursive(files, 0);
}

function formatCodeblocksRecursive(files, indentLevel) {
  let output = "";
  const indent = "  ".repeat(indentLevel);

  files.forEach((file) => {
    if (file.isDirectory) {
      output += `${indent}Directory: ${file.path}\n`;
      output += formatCodeblocksRecursive(file.children, indentLevel + 1);
    } else {
      output += `${indent}File: ${file.path}\n`;
      if (file.tokenCount !== undefined) {
        output += `${indent}Token Count: ${file.tokenCount}\n`;
      }
      output += `${indent}\`\`\`\n${file.content}\n\`\`\`\n\n`;
    }
  });

  return output;
}

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
    }
  });
}
