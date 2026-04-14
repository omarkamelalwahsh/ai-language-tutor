import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
/**
 * Resilient Retry Logic with Exponential Backoff
 * Skips retries for 4xx Client/Validation errors.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  initialDelay: number = 500
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Do not retry 4xx errors (Client/Validation errors)
      if (error.status && error.status >= 400 && error.status < 500) {
        console.error(`[withRetry] Persistent 4xx error: ${error.message}`);
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt); // Exponential Backoff
        console.warn(`[withRetry] Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error(`[withRetry] All ${maxRetries} attempts failed.`);
  throw lastError;
}

/**
 * Utility to ensure deterministic UUIDs from string IDs (e.g. node_1)
 */
export function toValidUUID(id: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id;

  // Use a fixed namespace + deterministic hash
  let hash = 0;
  const namespace = "ai-language-tutor-v2";
  const combined = namespace + id;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; 
  }
  const hex = Math.abs(hash).toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`; 
}
