// Error handling utility with retry logic and user-friendly messages

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export class NetworkError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class SyncError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'SyncError';
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, retryDelay = 1000, onRetry } = options;
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on last attempt
      if (attempt < maxRetries) {
        if (onRetry) {
          onRetry(attempt + 1, error);
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }

  throw lastError!;
}

export function getErrorMessage(error: any): string {
  if (error instanceof NetworkError) {
    return error.message;
  }
  if (error instanceof SyncError) {
    return error.message;
  }
  if (error?.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

export function isNetworkError(error: any): boolean {
  return error instanceof NetworkError ||
         error?.name === 'NetworkError' ||
         error?.code === 'ECONNREFUSED' ||
         error?.code === 'ETIMEDOUT' ||
         error?.message?.includes('network') ||
         error?.message?.includes('fetch');
}

