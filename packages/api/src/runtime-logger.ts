import fs from "node:fs";
import path from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEntry = {
  level: LogLevel;
  time: string;
  message: string;
};

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MAX_BUFFER = Math.max(
  100,
  parseInt(process.env.LOG_MAX_LINES || "10000", 10) || 10000,
);

const entries: LogEntry[] = [];
let fileStream: fs.WriteStream | null = null;
let logFilePath = "";

function resolvePaths() {
  const dir = process.env.LOG_DIR || path.join(process.cwd(), "logs");
  const file =
    process.env.LOG_FILE || path.join(dir, "app.log");
  return { dir, file };
}

function initFile() {
  try {
    const { dir, file } = resolvePaths();
    fs.mkdirSync(dir, { recursive: true });
    logFilePath = path.resolve(file);
    fileStream = fs.createWriteStream(logFilePath, { flags: "a" });
    fileStream.on("error", (err) => {
      process.stderr.write(`[runtime-logger] file write error: ${err}\n`);
    });
  } catch (e) {
    process.stderr.write(`[runtime-logger] failed to init log file: ${e}\n`);
  }
}

function pushLine(level: LogLevel, message: string) {
  const entry: LogEntry = {
    level,
    time: new Date().toISOString(),
    message,
  };
  entries.push(entry);
  while (entries.length > MAX_BUFFER) {
    entries.shift();
  }
  const line = JSON.stringify(entry) + "\n";
  fileStream?.write(line);
}

function formatArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === "string") return a;
      if (a instanceof Error) return a.stack || a.message;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");
}

let installed = false;

export function installRuntimeLogger() {
  if (installed) return;
  installed = true;
  initFile();

  const origLog = console.log.bind(console);
  const origInfo = console.info.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);
  const origDebug = console.debug.bind(console);

  console.log = (...args: unknown[]) => {
    pushLine("info", formatArgs(args));
    origLog(...args);
  };
  console.info = (...args: unknown[]) => {
    pushLine("info", formatArgs(args));
    origInfo(...args);
  };
  console.warn = (...args: unknown[]) => {
    pushLine("warn", formatArgs(args));
    origWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    pushLine("error", formatArgs(args));
    origError(...args);
  };
  console.debug = (...args: unknown[]) => {
    pushLine("debug", formatArgs(args));
    origDebug(...args);
  };
}

export type LogQueryLevel = LogLevel | "all";

export function getLogEntries(options: {
  minLevel?: LogQueryLevel;
  limit?: number;
}): { entries: LogEntry[]; total: number; logFile: string | null } {
  const minLevel = options.minLevel ?? "all";
  const limit = Math.min(Math.max(options.limit ?? 500, 1), 5000);

  let filtered = entries;
  if (minLevel !== "all") {
    const rank = LEVEL_RANK[minLevel];
    filtered = entries.filter((e) => LEVEL_RANK[e.level] >= rank);
  }
  const total = filtered.length;
  const slice = filtered.slice(-limit);
  return { entries: slice, total, logFile: logFilePath || null };
}

installRuntimeLogger();
