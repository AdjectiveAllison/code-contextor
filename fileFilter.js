import path from "path";

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

function detectLanguage(files) {
  const extensions = files.map((file) => path.extname(file.path).toLowerCase());
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

function isTokenCountAnomaly(file, averageTokenCount, standardDeviation) {
  const threshold = averageTokenCount + 2 * standardDeviation;
  return (
    file.tokenCount > threshold && file.tokenCount > TOKEN_ANOMALY_THRESHOLD
  );
}

export function filterFiles(files, options) {
  const language = detectLanguage(files);
  const languageIgnores = LANGUAGE_SPECIFIC_IGNORES[language] || [];

  let filteredFiles = files;
  let removedFiles = {
    languageSpecific: [],
    configurationFiles: [],
    tokenAnomaly: [],
  };

  if (!options.disableLanguageFilter) {
    filteredFiles = filteredFiles.filter((file) => {
      const shouldKeep = !languageIgnores.some((pattern) =>
        new RegExp(pattern.replace("*", ".*")).test(file.path),
      );
      if (!shouldKeep) {
        removedFiles.languageSpecific.push(file);
      }
      return shouldKeep;
    });
  }

  if (!options.disableConfigFilter) {
    filteredFiles = filteredFiles.filter((file) => {
      const shouldKeep = !CONFIGURATION_FILE_IGNORES.some((pattern) =>
        new RegExp(pattern.replace("*", ".*")).test(path.basename(file.path)),
      );
      if (!shouldKeep) {
        removedFiles.configurationFiles.push(file);
      }
      return shouldKeep;
    });
  }

  const totalTokens = filteredFiles.reduce(
    (sum, file) => sum + file.tokenCount,
    0,
  );

  if (!options.disableTokenFilter && totalTokens > TOTAL_TOKEN_THRESHOLD) {
    const tokenCounts = filteredFiles.map((file) => file.tokenCount);
    const averageTokenCount =
      tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length;
    const standardDeviation = Math.sqrt(
      tokenCounts
        .map((x) => Math.pow(x - averageTokenCount, 2))
        .reduce((a, b) => a + b, 0) / tokenCounts.length,
    );

    filteredFiles = filteredFiles.filter((file) => {
      const shouldKeep = !isTokenCountAnomaly(
        file,
        averageTokenCount,
        standardDeviation,
      );
      if (!shouldKeep) {
        removedFiles.tokenAnomaly.push(file);
      }
      return shouldKeep;
    });
  }

  return { filteredFiles, removedFiles, detectedLanguage: language };
}
