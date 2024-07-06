import path from "path";
import { logger } from "../utils/logger.js";

const LANGUAGE_SPECIFIC_IGNORES = {
  javascript: ["package-lock.json", "yarn.lock", "npm-debug.log"],
  typescript: ["*.tsbuildinfo"],
  python: ["Pipfile.lock", "*.pyc", "__pycache__", "*.pyo", "*.pyd"],
  java: ["*.class", "*.jar", "target/"],
  csharp: ["bin/", "obj/", "*.csproj.user"],
  cpp: ["*.o", "*.obj", "*.exe", "*.dll", "*.so", "*.dylib"],
  php: ["vendor/", "composer.lock"],
  ruby: ["Gemfile.lock", "*.gem"],
  go: ["go.sum"],
  rust: ["Cargo.lock", "target/"],
  swift: ["*.swiftmodule", "*.swiftdoc", "*.swiftsourceinfo"],
  kotlin: ["*.kotlin_module", "build/"],
  scala: ["*.class", "target/"],
  zig: ["zig-cache/", "zig-out/"],
};

const CONFIGURATION_FILE_IGNORES = [
  "package.json",
  "*.yaml",
  "*.yml",
  "*.toml",
  "*.ini",
  "*.config.js",
  "*.conf",
  "Makefile",
  "CMakeLists.txt",
  "*.vcxproj",
  "*.sln",
  "*.pbxproj",
  "*.xcodeproj",
  "*.gradle",
  "*.sbt",
  "*.cabal",
  "*.csproj",
  "*.vbproj",
  "*.fsproj",
  "*.zig.zon",
];

const TOKEN_ANOMALY_THRESHOLD = 10000; // Minimum tokens for a file to be considered an anomaly
const TOTAL_TOKEN_THRESHOLD = 50000; // Minimum total tokens to apply anomaly detection

export function applyFilters(files, config) {
  logger.info("Applying filters to files");
  const language = detectLanguage(files);
  logger.info(`Detected language: ${language}`);

  let filteredFiles = files;
  let removedFiles = {
    languageSpecific: [],
    configurationFiles: [],
    tokenAnomaly: [],
  };

  if (!config.disableLanguageFilter) {
    const result = applyLanguageFilter(filteredFiles, language);
    filteredFiles = result.filteredFiles;
    removedFiles.languageSpecific = result.removedFiles;
  }

  if (!config.disableConfigFilter) {
    const result = applyConfigFilter(filteredFiles);
    filteredFiles = result.filteredFiles;
    removedFiles.configurationFiles = result.removedFiles;
  }

  if (!config.disableTokenFilter) {
    const result = applyTokenFilter(filteredFiles);
    filteredFiles = result.filteredFiles;
    removedFiles.tokenAnomaly = result.removedFiles;
  }

  logger.info(`Files removed:
    Language-specific: ${removedFiles.languageSpecific.length}
    Configuration files: ${removedFiles.configurationFiles.length}
    Token anomalies: ${removedFiles.tokenAnomaly.length}`);

  return { filteredFiles, removedFiles, detectedLanguage: language };
}

function detectLanguage(files) {
  const extensions = files
    .filter((file) => !file.isDirectory)
    .map((file) => path.extname(file.path).toLowerCase());

  if (extensions.length === 0) {
    return "unknown";
  }

  const counts = extensions.reduce((acc, ext) => {
    acc[ext] = (acc[ext] || 0) + 1;
    return acc;
  }, {});

  const primaryExtension = Object.entries(counts).sort(
    (a, b) => b[1] - a[1],
  )[0][0];

  switch (primaryExtension) {
    case ".js":
    case ".jsx":
    case ".mjs":
      return "javascript";
    case ".ts":
    case ".tsx":
      return "typescript";
    case ".py":
      return "python";
    case ".java":
      return "java";
    case ".cs":
      return "csharp";
    case ".cpp":
    case ".cxx":
    case ".cc":
    case ".c":
    case ".h":
    case ".hpp":
      return "cpp";
    case ".php":
      return "php";
    case ".rb":
      return "ruby";
    case ".go":
      return "go";
    case ".rs":
      return "rust";
    case ".swift":
      return "swift";
    case ".kt":
    case ".kts":
      return "kotlin";
    case ".scala":
      return "scala";
    case ".zig":
      return "zig";
    default:
      return "unknown";
  }
}

function applyLanguageFilter(files, language) {
  const languageIgnores = LANGUAGE_SPECIFIC_IGNORES[language] || [];
  const filteredFiles = [];
  const removedFiles = [];

  files.forEach((file) => {
    if (file.isDirectory) {
      const result = applyLanguageFilter(file.children, language);
      if (result.filteredFiles.length > 0) {
        filteredFiles.push({
          ...file,
          children: result.filteredFiles,
        });
      }
      removedFiles.push(...result.removedFiles);
    } else {
      const shouldKeep = !languageIgnores.some((pattern) =>
        new RegExp(pattern.replace("*", ".*")).test(file.path),
      );
      if (shouldKeep) {
        filteredFiles.push(file);
      } else {
        removedFiles.push(file);
      }
    }
  });

  return { filteredFiles, removedFiles };
}

function applyConfigFilter(files) {
  const filteredFiles = [];
  const removedFiles = [];

  files.forEach((file) => {
    if (file.isDirectory) {
      const result = applyConfigFilter(file.children);
      if (result.filteredFiles.length > 0) {
        filteredFiles.push({
          ...file,
          children: result.filteredFiles,
        });
      }
      removedFiles.push(...result.removedFiles);
    } else {
      const shouldKeep = !CONFIGURATION_FILE_IGNORES.some((pattern) =>
        new RegExp(pattern.replace("*", ".*")).test(path.basename(file.path)),
      );
      if (shouldKeep) {
        filteredFiles.push(file);
      } else {
        removedFiles.push(file);
      }
    }
  });

  return { filteredFiles, removedFiles };
}

function applyTokenFilter(files) {
  const flatFiles = flattenFiles(files);
  const totalTokens = flatFiles.reduce(
    (sum, file) => sum + (file.tokenCount || 0),
    0,
  );

  if (totalTokens <= TOTAL_TOKEN_THRESHOLD) {
    logger.info(
      "Token count anomaly filter not applied due to low total token count.",
    );
    return { filteredFiles: files, removedFiles: [] };
  }

  const tokenCounts = flatFiles.map((file) => file.tokenCount || 0);
  const averageTokenCount =
    tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length;
  const standardDeviation = Math.sqrt(
    tokenCounts
      .map((x) => Math.pow(x - averageTokenCount, 2))
      .reduce((a, b) => a + b, 0) / tokenCounts.length,
  );

  return filterAnomalies(files, averageTokenCount, standardDeviation);
}

function filterAnomalies(files, averageTokenCount, standardDeviation) {
  const filteredFiles = [];
  const removedFiles = [];

  files.forEach((file) => {
    if (file.isDirectory) {
      const result = filterAnomalies(
        file.children,
        averageTokenCount,
        standardDeviation,
      );
      if (result.filteredFiles.length > 0) {
        filteredFiles.push({
          ...file,
          children: result.filteredFiles,
        });
      }
      removedFiles.push(...result.removedFiles);
    } else {
      if (!isTokenCountAnomaly(file, averageTokenCount, standardDeviation)) {
        filteredFiles.push(file);
      } else {
        removedFiles.push(file);
      }
    }
  });

  return { filteredFiles, removedFiles };
}

function isTokenCountAnomaly(file, averageTokenCount, standardDeviation) {
  const threshold = averageTokenCount + 2 * standardDeviation;
  return (
    (file.tokenCount || 0) > threshold &&
    (file.tokenCount || 0) > TOKEN_ANOMALY_THRESHOLD
  );
}

function flattenFiles(files) {
  return files.reduce((acc, file) => {
    if (file.isDirectory) {
      return acc.concat(flattenFiles(file.children));
    }
    return acc.concat(file);
  }, []);
}
