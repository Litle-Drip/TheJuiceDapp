const isDev = import.meta.env.DEV;

export function logError(context: string, error: unknown): void {
  if (isDev) {
    console.error(`[${context}]`, error);
  }
}

export function logWarn(context: string, message: string): void {
  if (isDev) {
    console.warn(`[${context}]`, message);
  }
}
