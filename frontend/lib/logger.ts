/**
 * Structured frontend logger with context support.
 * Replaces ad-hoc console.log calls with a consistent format.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: Record<string, unknown>;
  requestId?: string;
}

let globalRequestId: string | undefined;

export function setRequestId(id: string): void {
  globalRequestId = id;
}

export function getRequestId(): string | undefined {
  return globalRequestId;
}

function createEntry(
  level: LogLevel,
  component: string,
  message: string,
  data?: Record<string, unknown>,
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    component,
    message,
    ...(data && { data }),
    ...(globalRequestId && { requestId: globalRequestId }),
  };
}

function emit(entry: LogEntry): void {
  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.component}]`;
  const suffix = entry.requestId ? ` req=${entry.requestId}` : '';

  switch (entry.level) {
    case 'error':
      console.error(`${prefix}${suffix}`, entry.message, entry.data ?? '');
      break;
    case 'warn':
      console.warn(`${prefix}${suffix}`, entry.message, entry.data ?? '');
      break;
    case 'debug':
      console.debug(`${prefix}${suffix}`, entry.message, entry.data ?? '');
      break;
    default:
      console.log(`${prefix}${suffix}`, entry.message, entry.data ?? '');
  }
}

export function createLogger(component: string) {
  return {
    debug(message: string, data?: Record<string, unknown>) {
      emit(createEntry('debug', component, message, data));
    },
    info(message: string, data?: Record<string, unknown>) {
      emit(createEntry('info', component, message, data));
    },
    warn(message: string, data?: Record<string, unknown>) {
      emit(createEntry('warn', component, message, data));
    },
    error(message: string, data?: Record<string, unknown>) {
      emit(createEntry('error', component, message, data));
    },
  };
}
