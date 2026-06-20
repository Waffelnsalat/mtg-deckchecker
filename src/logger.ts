type LogLevel = "info" | "warn" | "error";

export interface Logger {
  info(message: string, details?: unknown): void;
  warn(message: string, details?: unknown): void;
  error(message: string, details?: unknown): void;
}

export function createLogger(scope: string): Logger {
  return {
    info: (message, details) => writeLog("info", scope, message, details),
    warn: (message, details) => writeLog("warn", scope, message, details),
    error: (message, details) => writeLog("error", scope, message, details),
  };
}

function writeLog(
  level: LogLevel,
  scope: string,
  message: string,
  details?: unknown,
) {
  const line = [
    new Date().toISOString(),
    level.toUpperCase(),
    `[${scope}]`,
    message,
    formatDetails(details),
  ]
    .filter(Boolean)
    .join(" ");

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

function formatDetails(details: unknown): string {
  if (details === undefined) {
    return "";
  }

  if (details instanceof Error) {
    return `${details.name}: ${details.message}`;
  }

  if (typeof details === "string") {
    return details;
  }

  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}
