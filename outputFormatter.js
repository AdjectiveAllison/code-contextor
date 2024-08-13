export function formatOutput(file, format) {
  switch (format) {
    case "xml":
      return `<file: ${file.path}>${file.content}\n</file: ${file.path}>`;
    case "json":
      return JSON.stringify({ path: file.path, content: file.content });
    case "codeblocks":
      return `File: ${file.path}\n\`\`\`\n${file.content}\n\`\`\``;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}
