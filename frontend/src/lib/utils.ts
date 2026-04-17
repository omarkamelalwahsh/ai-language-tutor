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

/**
 * Exhaustively extracts MCQ options from various answer_key JSON structures.
 * Supports legacy, new bank, and generated formats.
 */
export function extractOptions(ak: any): string[] {
  if (!ak) return [];
  
  let parsed: any = null;
  try {
    parsed = typeof ak === "string" ? JSON.parse(ak) : ak;
  } catch (e) {
    return [];
  }
  
  if (!parsed) return [];

  // Priority 0: Input is already an array
  if (Array.isArray(parsed)) {
    if (parsed.length > 0 && typeof parsed[0] === 'object') {
       return parsed.map((o: any) => o.text || o.label || "");
    }
    return parsed;
  }

  // Priority 1: Top-level options array
  if (Array.isArray(parsed.options)) {
    // Check if it's an array of strings or objects
    if (parsed.options.length > 0 && typeof parsed.options[0] === 'object') {
      return parsed.options.map((o: any) => o.text || o.label || "");
    }
    return parsed.options;
  }
  
  // Priority 2: Nested in value property (Legacy format)
  if (parsed.value && Array.isArray(parsed.value.options)) {
    return parsed.value.options;
  }

  return [];
}

/**
 * Extracts the correct index or value from various answer_key structures.
 */
export function extractAnswerMetadata(ak: any, options: string[]): { correctIndex: number | null; correctValue: string | null } {
  if (!ak) return { correctIndex: null, correctValue: null };
  
  let parsed: any = null;
  try {
    parsed = typeof ak === "string" ? JSON.parse(ak) : ak;
  } catch (e) {
    return { correctIndex: null, correctValue: null };
  }
  
  if (!parsed) return { correctIndex: null, correctValue: null };

  let correctIndex: number | null = null;
  let correctValue: string | null = null;

  // Extract correctValue
  correctValue = parsed.correct || parsed.correctValue || parsed.correct_answer || parsed.value?.correct_answer || null;

  // Extract correctIndex
  if (parsed.correct_index !== undefined && parsed.correct_index !== -1) {
    correctIndex = parsed.correct_index;
  } else if (parsed.value?.correct_index !== undefined) {
    correctIndex = parsed.value.correct_index;
  }

  // Cross-compute if one is missing
  if (correctValue && (correctIndex === null || correctIndex === -1) && options.length > 0) {
    const idx = options.findIndex(o => o.trim().toLowerCase() === correctValue!.trim().toLowerCase());
    if (idx >= 0) correctIndex = idx;
  } else if (correctIndex !== null && correctIndex >= 0 && !correctValue && options[correctIndex]) {
    correctValue = options[correctIndex];
  }

  return { correctIndex, correctValue };
}
