import { create } from 'zustand';

export type LogType = 'log' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  type: LogType;
  message: string;
  timestamp: string;
  count?: number;
}

interface LogStore {
  logs: LogEntry[];
  addLog: (type: LogType, message: string) => void;
  addLogs: (newLogs: { type: LogType, message: string }[]) => void;
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
    let nextLogs = [...state.logs];
    const lastLog = nextLogs[nextLogs.length - 1];
    
    if (lastLog && lastLog.type === type && lastLog.message === message) {
      nextLogs[nextLogs.length - 1] = {
        ...lastLog,
        count: (lastLog.count || 1) + 1,
        timestamp: getTimestamp(),
      };
    } else {
      nextLogs.push({
        id: crypto.randomUUID(),
        type,
        message,
        timestamp: getTimestamp(),
        count: 1,
      });
    }

    if (nextLogs.length > 1000) {
      nextLogs = nextLogs.slice(nextLogs.length - 1000);
    }
    return { logs: nextLogs };
  }),
  addLogs: (newLogs) => set((state) => {
    let nextLogs = [...state.logs];
    for (const log of newLogs) {
      const lastLog = nextLogs[nextLogs.length - 1];
      if (lastLog && lastLog.type === log.type && lastLog.message === log.message) {
        nextLogs[nextLogs.length - 1] = {
          ...lastLog,
          count: (lastLog.count || 1) + 1,
          timestamp: getTimestamp(),
        };
      } else {
        nextLogs.push({
          id: crypto.randomUUID(),
          type: log.type,
          message: log.message,
          timestamp: getTimestamp(),
          count: 1,
        });
      }
    }
    if (nextLogs.length > 1000) {
      nextLogs = nextLogs.slice(nextLogs.length - 1000);
    }
    return { logs: nextLogs };
  }),
  clearLogs: () => set({ logs: [] }),
}));

let logQueue: { type: LogType, message: string }[] = [];
let flushTimeout: any = null;

function queueLog(type: LogType, message: string) {
  logQueue.push({ type, message });
  if (!flushTimeout) {
    flushTimeout = setTimeout(() => {
      if (logQueue.length > 0) {
        useLogStore.getState().addLogs(logQueue);
        logQueue = [];
      }
      flushTimeout = null;
    }, 150);
  }
}

let isIntercepting = false;

function safeStringify(arg: any): string {
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  if (arg instanceof Error) {
    return `${arg.name || 'Error'}: ${arg.message}${arg.stack ? `\n${arg.stack}` : ''}`;
  }
  if (typeof arg === 'object') {
    if (arg.message && (arg.stack || arg.name)) {
      return `${arg.name || 'Error'}: ${arg.message}${arg.stack ? `\n${arg.stack}` : ''}`;
    }
    // Safely handle Three.js objects — never deep-serialize WebGL scene graphs
    if (arg.isObject3D) {
      return `[THREE.Object3D: ${arg.type || 'Object3D'}${arg.name ? ` "${arg.name}"` : ''}]`;
    }
    if (arg.isMaterial) {
      return `[THREE.Material: ${arg.type || 'Material'}]`;
    }
    if (arg.isBufferGeometry) {
      return `[THREE.BufferGeometry]`;
    }
    if (arg.isTexture) {
      return `[THREE.Texture${arg.name ? ` "${arg.name}"` : ''}]`;
    }
    if (arg.isScene || arg.isCamera || arg.isRenderer) {
      return `[THREE.${arg.type || arg.constructor?.name || 'WebGLObject'}]`;
    }
    try {
      return JSON.stringify(arg, null, 2);
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
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args: any[]) => {
    originalLog.apply(console, args);
    const message = args.map(safeStringify).join(' ');
    queueLog('log', message);
  };

  console.info = (...args: any[]) => {
    originalInfo.apply(console, args);
    const message = args.map(safeStringify).join(' ');
    queueLog('log', message);
  };

  console.warn = (...args: any[]) => {
    originalWarn.apply(console, args);
    const message = args.map(safeStringify).join(' ');
    queueLog('warn', message);
  };

  console.error = (...args: any[]) => {
    originalError.apply(console, args);
    const message = args.map(safeStringify).join(' ');
    queueLog('error', message);
  };

  window.addEventListener('error', (event) => {
    setTimeout(() => {
      const errorDetail = event.error ? safeStringify(event.error) : event.message;
      useLogStore.getState().addLog('error', `[Uncaught Error] ${errorDetail} at ${event.filename}:${event.lineno}`);
    }, 0);
  });

  window.addEventListener('unhandledrejection', (event) => {
    // Ignore transient browser pointer lock exit-reentry timing SecurityError
    const reasonMsg = event.reason ? String(event.reason?.message || event.reason) : '';
    if (
      event.reason?.name === 'SecurityError' &&
      reasonMsg.includes('Pointer lock cannot be acquired immediately')
    ) {
      event.preventDefault();
      return;
    }

    setTimeout(() => {
      const reason = event.reason ? safeStringify(event.reason) : 'Unknown promise rejection';
      useLogStore.getState().addLog('error', `[Unhandled Promise Rejection] ${reason}`);
    }, 0);
  });
}
