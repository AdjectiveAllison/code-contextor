function formatXml(files) {
  if (files.length === 1) {
    const file = files[0];
    return [
      "<file>",
      `  <path>${file.path}</path>`,
      "  <content><![CDATA[",
      file.content,
      "  ]]></content>",
      "</file>",
    ].join("\n");
  }

  let output = "<files>\n";
  for (const file of files) {
    output += [
      "  <file>",
      `    <path>${file.path}</path>`,
      "    <content><![CDATA[",
      file.content,
      "    ]]></content>",
      "  </file>\n",
    ].join("\n");
  }
  output += "</files>\n";
  output += "<file_list>\n";
  output += files.map((file) => file.path).join("\n");
  output += "\n</file_list>";
  return output;
}

function formatJson(files) {
  if (files.length === 1) {
    return JSON.stringify(files[0]);
  }
  return JSON.stringify({
    files: files.map((file) => ({ path: file.path, content: file.content })),
    file_list: files.map((file) => file.path),
  });
}

function formatCodeblocks(files) {
  let output = "";
  for (const file of files) {
    output += `File: ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n\n`;
  }
  if (files.length > 1) {
    output += "File list:\n";
    output += files.map((file) => file.path).join("\n");
  }
  return output;
}

export function formatOutput(files, format) {
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
