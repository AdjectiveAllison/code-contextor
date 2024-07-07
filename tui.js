import blessed from "blessed";
import { processFiles } from "./core/fileProcessor.js";
import { tokenizeFiles } from "./core/tokenizer.js";
import { applyFilters } from "./core/filter.js";
import { formatOutput, getAvailableFormats } from "./core/formatter.js";
import { logger } from "./utils/logger.js";
import { getTokenizerDescription, TOKENIZER_OPTIONS } from "./utils/config.js";
import fs from "fs/promises";
import path from "path";
import clipboardy from "clipboardy";

export async function runTUI(config) {
  let screen;
  try {
    logger.switchToTUIMode();
    screen = blessed.screen({
      smartCSR: true,
      title: "Code Contextor",
    });
  } catch (error) {
    logger.switchToConsoleMode();
    logger.error("Failed to create blessed screen:", error.message);
    console.error(
      "Your terminal might not be fully compatible with the TUI mode.",
    );
    console.error(
      "Please try running in non-interactive mode with --non-interactive flag.",
    );
    process.exit(1);
  }

  const layout = createLayout(screen);
  let files = [];
  let filteredFiles = [];

  screen.key(["escape", "q", "C-c"], () => {
    logger.switchToConsoleMode();
    process.exit(0);
  });
  screen.key("?", () => showHelp(screen));

  try {
    updateStatus(layout, "Processing files...");
    files = await processFiles(config.directory, config);
    updateFileTree(layout, files);

    updateStatus(layout, "Tokenizing files...");
    files = await tokenizeFiles(files, config.tokenizer);
    updateFileTree(layout, files);

    updateStatus(layout, "Applying filters...");
    const filterResult = applyFilters(files, config);
    filteredFiles = filterResult.filteredFiles;
    updateFileTree(layout, filteredFiles);

    updateStatus(layout, "Ready");
    updateInfo(
      layout,
      getInfoContent(config, files, filteredFiles, filterResult),
    );

    setupEventHandlers(
      screen,
      layout,
      config,
      files,
      filteredFiles,
      filterResult,
    );

    // Start log update interval
    const logUpdateInterval = setInterval(() => updateLogView(layout), 1000);

    screen.on("destroy", () => {
      clearInterval(logUpdateInterval);
      logger.switchToConsoleMode();
    });

    screen.render();
  } catch (error) {
    logger.error("An error occurred:", error.message);
    updateStatus(layout, `Error: ${error.message}`);
  }
}

function createLayout(screen) {
  return {
    screen,
    fileTree: blessed.box({
      parent: screen,
      left: 0,
      top: 0,
      width: "50%",
      height: "70%",
      border: { type: "line" },
      label: " File Tree ",
      keys: true,
      vi: true,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: { ch: " ", bg: "cyan" },
    }),
    info: blessed.box({
      parent: screen,
      right: 0,
      top: 0,
      width: "50%",
      height: "70%",
      border: { type: "line" },
      label: " Info ",
      content: "Select a file or directory for more information",
      padding: 1,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: { ch: " ", bg: "cyan" },
    }),
    logView: blessed.log({
      parent: screen,
      bottom: 3,
      left: 0,
      width: "100%",
      height: "30%-3",
      border: { type: "line" },
      label: " Logs ",
      scrollable: true,
      alwaysScroll: true,
      scrollbar: { ch: " ", bg: "cyan" },
    }),
    status: blessed.box({
      parent: screen,
      bottom: 0,
      width: "100%",
      height: 3,
      border: { type: "line" },
      content: "Ready",
    }),
    menu: blessed.listbar({
      parent: screen,
      bottom: 3,
      left: 0,
      width: "100%",
      height: 3,
      style: {
        bg: "blue",
        item: {
          bg: "blue",
          hover: {
            bg: "green",
          },
        },
        selected: {
          bg: "green",
        },
      },
      commands: {
        "Change Tokenizer": () => changeTokenizer(screen, config),
        "Change Format": () => changeExportFormat(screen, config),
        Export: () => exportOutput(screen, config, filteredFiles),
        Help: () => showHelp(screen),
        Quit: () => process.exit(0),
      },
    }),
  };
}

function updateFileTree(layout, files) {
  let content = "";
  function traverseFiles(files, indent = "") {
    files.forEach((file) => {
      const icon = file.isDirectory ? "📁" : "📄";
      const tokenInfo =
        file.tokenCount !== undefined ? ` (${file.tokenCount} tokens)` : "";
      content += `${indent}${icon} ${file.path}${tokenInfo}\n`;
      if (file.isDirectory && file.children) {
        traverseFiles(file.children, indent + "  ");
      }
    });
  }
  traverseFiles(files);
  layout.fileTree.setContent(content);
}

function updateStatus(layout, message) {
  layout.status.setContent(message);
  layout.screen.render();
}

function updateInfo(layout, content) {
  layout.info.setContent(content);
  layout.screen.render();
}

function updateLogView(layout) {
  const tuiHandler = logger.getTUIHandler();
  if (tuiHandler) {
    const latestLogs = tuiHandler.getLatestLogs(10);
    latestLogs.forEach((log) => {
      layout.logView.log(log.message);
    });
    layout.screen.render();
  }
}

function getInfoContent(config, files, filteredFiles, filterResult) {
  const totalFiles = countFiles(files);
  const totalTokens = calculateTotalTokens(files);
  const filteredTotalFiles = countFiles(filteredFiles);
  const filteredTotalTokens = calculateTotalTokens(filteredFiles);

  return `
Directory: ${config.directory}
Current Tokenizer: ${getTokenizerDescription(config.tokenizer)}
Current Format: ${config.format}

Total Files: ${totalFiles}
Total Tokens: ${totalTokens}

Filtered Files: ${filteredTotalFiles}
Filtered Tokens: ${filteredTotalTokens}

Removed Files:
  Language-specific: ${filterResult.removedFiles.languageSpecific.length}
  Configuration: ${filterResult.removedFiles.configurationFiles.length}
  Token Anomaly: ${filterResult.removedFiles.tokenAnomaly.length}

Detected Language: ${filterResult.detectedLanguage}

Press 'e' to export command
Press '?' for help
  `;
}

function setupEventHandlers(
  screen,
  layout,
  config,
  files,
  filteredFiles,
  filterResult,
) {
  layout.fileTree.on("select", (node) => {
    const selectedFile = findFile(files, node.content.split(" ")[1]);
    if (selectedFile) {
      updateInfo(layout, getFileInfo(selectedFile));
    }
  });

  screen.key("e", () =>
    showExportedCommand(screen, generateEquivalentCommand(config)),
  );

  screen.key("l", () =>
    toggleFilter(screen, layout, config, files, "disableLanguageFilter"),
  );
  screen.key("c", () =>
    toggleFilter(screen, layout, config, files, "disableConfigFilter"),
  );
  screen.key("t", () =>
    toggleFilter(screen, layout, config, files, "disableTokenFilter"),
  );
}

function findFile(files, path) {
  for (const file of files) {
    if (file.path === path) return file;
    if (file.isDirectory && file.children) {
      const found = findFile(file.children, path);
      if (found) return found;
    }
  }
  return null;
}

function getFileInfo(file) {
  if (file.isDirectory) {
    return `
Directory: ${file.path}
Total Files: ${countFiles(file.children)}
Total Tokens: ${file.tokenCount}
    `;
  } else {
    return `
File: ${file.path}
Tokens: ${file.tokenCount}
Content Preview:
${file.content.slice(0, 500)}${file.content.length > 500 ? "..." : ""}
    `;
  }
}

function toggleFilter(screen, layout, config, files, filterName) {
  config[filterName] = !config[filterName];
  const filterResult = applyFilters(files, config);
  updateFileTree(layout, filterResult.filteredFiles);
  updateInfo(
    layout,
    getInfoContent(config, files, filterResult.filteredFiles, filterResult),
  );
  updateStatus(
    layout,
    `${filterName} ${config[filterName] ? "disabled" : "enabled"}`,
  );
  screen.render();
}

function showHelp(screen) {
  const helpBox = blessed.box({
    parent: screen,
    top: "center",
    left: "center",
    width: "80%",
    height: "80%",
    border: {
      type: "line",
    },
    label: " Help ",
    content: `
      Code Contextor TUI Help:

      Navigation:
      - Use arrow keys to navigate
      - Enter to select

      Commands:
      - ?: Show this help menu
      - q or Esc: Quit the application

      Features:
      - Change Tokenizer: Select a different tokenizer
      - Change Format: Change the export format
      - Export: Save to file or copy to clipboard

      Press Esc to close this help menu
    `,
    style: {
      border: {
        fg: "white",
      },
    },
  });

  helpBox.key(["escape", "q", "?"], () => {
    screen.remove(helpBox);
    screen.render();
  });

  screen.render();
}

async function changeTokenizer(screen, config) {
  const tokenizerList = blessed.list({
    parent: screen,
    top: "center",
    left: "center",
    width: "50%",
    height: "50%",
    border: {
      type: "line",
    },
    label: " Select Tokenizer ",
    items: Object.keys(TOKENIZER_OPTIONS),
    style: {
      selected: {
        bg: "blue",
        fg: "white",
      },
    },
  });

  tokenizerList.on("select", async (item) => {
    config.tokenizer = item.content;
    screen.remove(tokenizerList);
    screen.render();

    // Re-run tokenization and filtering
    updateStatus(layout, "Re-tokenizing files...");
    files = await tokenizeFiles(files, config.tokenizer);
    updateFileTree(layout, files);

    updateStatus(layout, "Re-applying filters...");
    const filterResult = applyFilters(files, config);
    filteredFiles = filterResult.filteredFiles;
    updateFileTree(layout, filteredFiles);

    updateStatus(layout, "Ready");
    updateInfo(
      layout,
      getInfoContent(config, files, filteredFiles, filterResult),
    );
  });

  tokenizerList.focus();
  screen.render();
}

function changeExportFormat(screen, config) {
  const formatList = blessed.list({
    parent: screen,
    top: "center",
    left: "center",
    width: "50%",
    height: "50%",
    border: {
      type: "line",
    },
    label: " Select Export Format ",
    items: getAvailableFormats(),
    style: {
      selected: {
        bg: "blue",
        fg: "white",
      },
    },
  });

  formatList.on("select", (item) => {
    config.format = item.content;
    screen.remove(formatList);
    updateInfo(
      layout,
      getInfoContent(config, files, filteredFiles, filterResult),
    );
    screen.render();
  });

  formatList.focus();
  screen.render();
}

async function exportOutput(screen, config, filteredFiles) {
  const exportMenu = blessed.list({
    parent: screen,
    top: "center",
    left: "center",
    width: "50%",
    height: "50%",
    border: {
      type: "line",
    },
    label: " Export Options ",
    items: ["Save to File", "Copy to Clipboard"],
    style: {
      selected: {
        bg: "blue",
        fg: "white",
      },
    },
  });

  exportMenu.on("select", async (item) => {
    screen.remove(exportMenu);
    const formattedOutput = formatOutput(filteredFiles, config.format);

    if (item.content === "Save to File") {
      try {
        await fs.writeFile(config.output, formattedOutput);
        updateStatus(layout, `Output saved to ${config.output}`);
      } catch (error) {
        updateStatus(layout, `Error saving file: ${error.message}`);
      }
    } else if (item.content === "Copy to Clipboard") {
      try {
        await clipboardy.write(formattedOutput);
        updateStatus(layout, "Output copied to clipboard");
      } catch (error) {
        updateStatus(layout, `Error copying to clipboard: ${error.message}`);
      }
    }

    screen.render();
  });

  exportMenu.focus();
  screen.render();
}

function showExportedCommand(screen, command) {
  blessed.box({
    parent: screen,
    top: "center",
    left: "center",
    width: "80%",
    height: "50%",
    border: { type: "line" },
    label: " Exported Command ",
    content: command,
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    style: {
      border: { fg: "white" },
    },
  });
  screen.render();
}

function countFiles(files) {
  return files.reduce((count, file) => {
    if (file.isDirectory) {
      return count + countFiles(file.children);
    }
    return count + 1;
  }, 0);
}

function calculateTotalTokens(files) {
  return files.reduce((total, file) => {
    if (file.isDirectory) {
      return total + calculateTotalTokens(file.children);
    }
    return total + (file.tokenCount || 0);
  }, 0);
}

function generateEquivalentCommand(config) {
  let command = `node app.js --directory "${config.directory}"`;

  if (config.extensions)
    command += ` --extensions ${config.extensions.join(",")}`;
  if (config.ignorePatterns)
    command += ` --ignore ${config.ignorePatterns.join(",")}`;
  if (config.maxTokens !== Infinity)
    command += ` --max-tokens ${config.maxTokens}`;
  if (config.format !== "xml") command += ` --format ${config.format}`;
  if (config.tokenizer !== "Xenova/gpt-4")
    command += ` --tokenizer ${config.tokenizer}`;
  if (config.output !== "output.txt") command += ` --output ${config.output}`;
  if (config.disableLanguageFilter) command += " --disable-language-filter";
  if (config.disableConfigFilter) command += " --disable-config-filter";
  if (config.disableTokenFilter) command += " --disable-token-filter";
  if (config.includeDotFiles.length > 0)
    command += ` --include-dot-files ${config.includeDotFiles.join(",")}`;

  return command;
}
