import { create } from 'zustand';

export type LogType = 'log' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  type: LogType;
  message: string;
  timestamp: string;
}

interface LogStore {
  logs: LogEntry[];
  addLog: (type: LogType, message: string) => void;
  clearLogs: () => void;
}

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export const useLogStore = create<LogStore>((set) => ({
  logs: [],
  addLog: (type, message) => set((state) => {
    const nextLogs = [
      ...state.logs,
      {
        id: crypto.randomUUID(),
        type,
        message,
        timestamp: getTimestamp(),
      },
    ];
    if (nextLogs.length > 1000) {
      nextLogs.shift();
    }
    return { logs: nextLogs };
  }),
  clearLogs: () => set({ logs: [] }),
}));

let isIntercepting = false;

function safeStringify(arg: any): string {
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  if (typeof arg === 'object') {
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

export function initConsoleInterceptor() {
  if (isIntercepting || typeof window === 'undefined') return;
  isIntercepting = true;

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args: any[]) => {
    originalLog.apply(console, args);
    const message = args.map(safeStringify).join(' ');
    setTimeout(() => {
      useLogStore.getState().addLog('log', message);
    }, 0);
  };

  console.warn = (...args: any[]) => {
    originalWarn.apply(console, args);
    const message = args.map(safeStringify).join(' ');
    setTimeout(() => {
      useLogStore.getState().addLog('warn', message);
    }, 0);
  };

  console.error = (...args: any[]) => {
    originalError.apply(console, args);
    const message = args.map(safeStringify).join(' ');
    setTimeout(() => {
      useLogStore.getState().addLog('error', message);
    }, 0);
  };

  window.addEventListener('error', (event) => {
    setTimeout(() => {
      useLogStore.getState().addLog('error', `[Uncaught Error] ${event.message} at ${event.filename}:${event.lineno}`);
    }, 0);
  });

  window.addEventListener('unhandledrejection', (event) => {
    setTimeout(() => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
      useLogStore.getState().addLog('error', `[Unhandled Promise Rejection] ${reason}`);
    }, 0);
  });
}
