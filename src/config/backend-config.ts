/**
 * Centralized Backend Configuration
 * 
 * Single source of truth for LLM provider settings, circuit breaker,
 * and health checking. All services must import from here.
 */

// ============================================================================
// LLM Configuration
// ============================================================================

export const LLMConfig = {
  provider: 'groq' as const,
  model: 'llama-3.1-8b-instant',
  backendUrl: (import.meta as any).env?.PROD ? '' : 'http://localhost:3001',
  requestTimeoutMs: 8000,
  maxRetries: 0, // No retries — fail fast, fallback deterministic
} as const;

// ============================================================================
// Circuit Breaker (Client-Side)
// ============================================================================

interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
  isDisabled: boolean;
}

const CIRCUIT_BREAKER_COOLDOWN_MS = 30 * 1000; // 30 seconds for testing
const MAX_FAILURES_BEFORE_OPEN = 5; // 5 failures before opening

const state: CircuitBreakerState = {
  failureCount: 0,
  lastFailureTime: 0,
  isDisabled: false,
};

export const ClientCircuitBreaker = {
  /**
   * Returns true if the circuit is open (i.e., LLM calls should be skipped).
   */
  isOpen(): boolean {
    if (state.isDisabled) return true;
    if (state.failureCount < MAX_FAILURES_BEFORE_OPEN) return false;

    const elapsed = Date.now() - state.lastFailureTime;
    if (elapsed > CIRCUIT_BREAKER_COOLDOWN_MS) {
      // Cooldown expired — reset
      state.failureCount = 0;
      console.log('[ClientCircuitBreaker] Cooldown expired. Resetting to CLOSED.');
      return false;
    }
    return true;
  },

  /**
   * Record a failure. If threshold is reached, the circuit opens.
   */
  recordFailure(reason: string): void {
    state.failureCount++;
    state.lastFailureTime = Date.now();
    console.warn(`[ClientCircuitBreaker] Failure #${state.failureCount}: ${reason}`);
    if (state.failureCount >= MAX_FAILURES_BEFORE_OPEN) {
      console.warn(`[ClientCircuitBreaker] OPEN — skipping LLM for ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s`);
    }
  },

  /**
   * Record a success. Resets failure count.
   */
  recordSuccess(): void {
    if (state.failureCount > 0) {
      console.log('[ClientCircuitBreaker] Success. Resetting failure count.');
    }
    state.failureCount = 0;
  },

  /**
   * Manually reset the circuit breaker state.
   */
  reset(): void {
    state.failureCount = 0;
    state.lastFailureTime = 0;
    state.isDisabled = false;
    console.log('[ClientCircuitBreaker] State has been MANUALLY RESET.');
  },

  /**
   * Permanently disable LLM calls for this session.
   */
  disable(): void {
    state.isDisabled = true;
    console.warn('[ClientCircuitBreaker] LLM permanently disabled for this session.');
  },

  /**
   * Re-enable LLM calls if they were manually disabled.
   */
  enable(): void {
    state.isDisabled = false;
    console.log('[ClientCircuitBreaker] LLM re-enabled for this session.');
  },

  /**
   * Get current status for debugging.
   */
  getStatus() {
    return {
      isOpen: this.isOpen(),
      failureCount: state.failureCount,
      isDisabled: state.isDisabled,
    };
  },
};

// ============================================================================
// Health Check
// ============================================================================

let lastHealthCheck: { healthy: boolean; timestamp: number } | null = null;
const HEALTH_CHECK_CACHE_MS = 30_000; // Cache for 30 seconds

/**
 * Checks if the backend evaluator is healthy.
 * Caches the result for 30 seconds to avoid spamming.
 */
export async function isBackendHealthy(): Promise<boolean> {
  // If circuit breaker is open, don't even check
  if (ClientCircuitBreaker.isOpen()) return false;

  // Use cached result if fresh
  if (lastHealthCheck && (Date.now() - lastHealthCheck.timestamp) < HEALTH_CHECK_CACHE_MS) {
    return lastHealthCheck.healthy;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${LLMConfig.backendUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      lastHealthCheck = { healthy: false, timestamp: Date.now() };
      return false;
    }

    const data = await res.json();
    const healthy = data.healthy === true;
    lastHealthCheck = { healthy, timestamp: Date.now() };
    return healthy;
  } catch {
    lastHealthCheck = { healthy: false, timestamp: Date.now() };
    return false;
  }
}
