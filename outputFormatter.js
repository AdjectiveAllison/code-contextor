export function formatOutput(file, format) {
  switch (format) {
    case "xml":
      return `<file>\n<path>${escapeXml(file.path)}</path>\n<content>${escapeXml(file.content)}</content>\n</file>`;
    case "json":
      return JSON.stringify({ path: file.path, content: file.content });
    case "codeblocks":
      return `File: ${file.path}\n\`\`\`\n${file.content}\n\`\`\``;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
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
