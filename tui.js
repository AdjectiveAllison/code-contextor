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

// Color scheme definition (new)
const COLORS = {
  background: "black",
  border: "white",
  selected: "blue",
  highlight: "green",
  text: "white",
};

// Main TUI function
export async function runTUI(config) {
  let screen,
    layout,
    files = [],
    filteredFiles = [];

  try {
    logger.info("Entering runTUI function");
    logger.switchToTUIMode();
    logger.info("Switched to TUI mode");

    logger.info("Creating blessed screen");
    screen = blessed.screen({
      smartCSR: true,
      title: "Code Contextor",
      terminal: "xterm-256color",
      fullUnicode: true,
    });
    logger.info("Blessed screen created successfully");

    // Process files
    logger.info("Processing files");
    files = await processFiles(config.directory, config);
    logger.info("Files processed successfully");

    // Tokenize files
    logger.info("Tokenizing files");
    files = await tokenizeFiles(files, config.tokenizer);
    logger.info("Files tokenized successfully");

    // Apply filters
    logger.info("Applying filters");
    const filterResult = applyFilters(files, config);
    filteredFiles = filterResult.filteredFiles;
    logger.info("Filters applied successfully");

    // Create layout
    logger.info("Creating layout");
    layout = createLayout(screen, filteredFiles);
    applyColorScheme(layout);
    logger.info("Layout created and color scheme applied");

    // Update status and views
    logger.info("Updating views");
    updateStatus(layout, "Processing complete");
    updateFileTree(layout, filteredFiles);
    updateInfo(
      layout,
      getInfoContent(config, files, filteredFiles, filterResult),
    );
    logger.info("Views updated successfully");

    // Setup event handlers and navigation
    logger.info("Setting up event handlers and navigation");
    setupEventHandlers(
      screen,
      layout,
      config,
      files,
      filteredFiles,
      filterResult,
    );
    setupNavigation(screen, layout, config, files, filteredFiles);
    logger.info("Event handlers and navigation set up successfully");

    // Start log update interval
    logger.info("Starting log update interval");
    const logUpdateInterval = setInterval(() => updateLogView(layout), 1000);
    logger.info("Log update interval started");

    screen.on("destroy", () => {
      clearInterval(logUpdateInterval);
      logger.switchToConsoleMode();
      logger.info("Screen destroyed, switched back to console mode");
    });

    logger.info("Rendering screen");
    screen.render();
    logger.info("Screen rendered successfully");
  } catch (error) {
    logger.switchToConsoleMode();
    logger.error("An error occurred in runTUI:", error.message);
    console.error("Error stack:", error.stack);
    console.error(
      "Please try running in non-interactive mode with --non-interactive flag.",
    );
    process.exit(1);
  }
}
// Layout creation (modified)
function createLayout(screen, files) {
  return {
    screen,
    fileTree: blessed.box({
      parent: screen,
      left: 0,
      top: 0,
      width: "50%",
      height: "70%",
      content: "File Tree",
      border: { type: "line" },
      label: " File Tree ",
    }),
    info: blessed.box({
      parent: screen,
      right: 0,
      top: 0,
      width: "50%",
      height: "70%",
      content: "Select a file or directory for more information",
      border: { type: "line" },
      label: " Info ",
    }),
    logView: blessed.box({
      parent: screen,
      bottom: 3,
      left: 0,
      width: "100%",
      height: "30%-3",
      content: "Logs",
      border: { type: "line" },
      label: " Logs ",
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: " ",
        track: {
          bg: "cyan",
        },
        style: {
          inverse: true,
        },
      },
    }),
    status: blessed.box({
      parent: screen,
      bottom: 0,
      width: "100%",
      height: 3,
      content: "Ready",
      border: { type: "line" },
    }),
    menu: createMenu(screen),
  };
}

// File tree creation (new)
function createFileTree(screen, files) {
  const fileTree = blessed.tree({
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
    style: {
      selected: {
        bg: "blue",
        bold: true,
      },
    },
    template: {
      extend: function (node) {
        return node.isDirectory ? "📁" : "📄";
      },
    },
  });

  function buildTree(files) {
    return files.map((file) => ({
      name: `${file.path} ${file.tokenCount ? `(${file.tokenCount} tokens)` : ""}`,
      isDirectory: file.isDirectory,
      extended: file.isDirectory,
      children: file.children ? buildTree(file.children) : undefined,
    }));
  }

  fileTree.setData({
    extended: true,
    children: buildTree(files),
  });

  return fileTree;
}

// Menu creation
function createMenu(
  screen,
  layout,
  config,
  files,
  filteredFiles,
  filterResult,
) {
  return blessed.listbar({
    parent: screen,
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    mouse: true,
    keys: true,
    autoCommandKeys: true,
    border: "line",
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
      "Change Tokenizer": () => changeTokenizer(screen, layout, config, files),
      "Change Format": () =>
        changeExportFormat(
          screen,
          layout,
          config,
          files,
          filteredFiles,
          filterResult,
        ),
      Export: () => exportOutput(screen, layout, config, filteredFiles),
      "Toggle Lang Filter": () =>
        toggleFilter(screen, layout, config, files, "disableLanguageFilter"),
      "Toggle Config Filter": () =>
        toggleFilter(screen, layout, config, files, "disableConfigFilter"),
      "Toggle Token Filter": () =>
        toggleFilter(screen, layout, config, files, "disableTokenFilter"),
      Help: () => showHelp(screen, layout),
      Quit: () => process.exit(0),
    },
  });
}

// Color scheme application (new)
function applyColorScheme(layout) {
  Object.values(layout).forEach((element) => {
    if (element.style) {
      element.style.bg = COLORS.background;
      element.style.fg = COLORS.text;
      if (element.style.border) {
        element.style.border.fg = COLORS.border;
      }
      if (element.style.selected) {
        element.style.selected.bg = COLORS.selected;
      }
      if (element.style.item && element.style.item.hover) {
        element.style.item.hover.bg = COLORS.highlight;
      }
    }
  });
}

// Event handlers setup
function setupEventHandlers(
  screen,
  layout,
  config,
  files,
  filteredFiles,
  filterResult,
) {
  layout.fileTree.on("select", (node) => {
    const selectedFile = findFile(files, node.name.split(" ")[0]);
    if (selectedFile) {
      updateInfo(layout, getFileInfo(selectedFile));
    }
  });

  screen.key("4", () =>
    toggleFilter(screen, layout, config, files, "disableLanguageFilter"),
  );
  screen.key("5", () =>
    toggleFilter(screen, layout, config, files, "disableConfigFilter"),
  );
  screen.key("6", () =>
    toggleFilter(screen, layout, config, files, "disableTokenFilter"),
  );

  screen.key("e", () =>
    showExportedCommand(screen, generateEquivalentCommand(config)),
  );
  screen.key(["7", "?"], () => showHelp(screen));
  screen.key(["q", "C-c"], () => process.exit(0));
}

// Navigation setup (new)
function setupNavigation(screen, layout, config, files, filteredFiles) {
  layout.fileTree.on("select", (node) => {
    const selectedFile = findFile(files, node.name.split(" ")[0]);
    if (selectedFile) {
      updateInfo(layout, getFileInfo(selectedFile));
    }
  });

  screen.key(["up", "down"], () => {
    layout.fileTree.focus();
  });

  screen.key(["1", "2", "3", "4", "5", "6"], (ch) => {
    const actions = [
      "changeTokenizer",
      "changeFormat",
      "export",
      "toggleLanguageFilter",
      "toggleConfigFilter",
      "toggleTokenFilter",
    ];
    layout.menu.emit("select", {}, layout.menu.items[parseInt(ch) - 1]);
  });
}

function showHelp(screen, layout) {
  if (layout.helpBox) {
    screen.remove(layout.helpBox);
    layout.helpBox = null;
  } else {
    layout.helpBox = blessed.box({
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
        - Up/Down: Navigate file tree
        - Enter: Select file/directory

        Commands:
        - 1: Change Tokenizer
        - 2: Change Export Format
        - 3: Export
        - 4: Toggle Language Filter
        - 5: Toggle Config Filter
        - 6: Toggle Token Filter
        - 7 or ?: Show/hide this help menu
        - q: Quit the application

        Press 7 or ? to close this help menu
      `,
      style: {
        border: {
          fg: "white",
        },
      },
    });
  }
  screen.render();
}

async function changeTokenizer(screen, layout, config, files) {
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
    keys: true,
    vi: true,
  });

  tokenizerList.on("select", async (item) => {
    config.tokenizer = item.content;
    screen.remove(tokenizerList);
    screen.render();

    // Re-run tokenization and filtering
    updateStatus(layout, "Re-tokenizing files...");
    files = await tokenizeFiles(files, config.tokenizer);

    const filterResult = applyFilters(files, config);
    const filteredFiles = filterResult.filteredFiles;
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

// Export format change
function changeExportFormat(
  screen,
  layout,
  config,
  files,
  filteredFiles,
  filterResult,
) {
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
    keys: true,
    vi: true,
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
// Output export
async function exportOutput(screen, layout, config, filteredFiles) {
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

// Filter toggle
function toggleFilter(screen, layout, config, files, filterName) {
  config[filterName] = !config[filterName];
  const filterResult = applyFilters(files, config);
  const filteredFiles = filterResult.filteredFiles;
  updateFileTree(layout, filteredFiles);
  updateInfo(
    layout,
    getInfoContent(config, files, filteredFiles, filterResult),
  );
  updateStatus(
    layout,
    `${filterName} ${config[filterName] ? "disabled" : "enabled"}`,
  );
  screen.render();
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
    const logContent = latestLogs.map((log) => log.message).join("\n");
    layout.logView.setContent(logContent);
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
