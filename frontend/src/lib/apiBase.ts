export function resolveApiBase(rawUrl?: string): string {
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const candidate = (rawUrl || '').trim();

  if (!candidate) {
    return currentOrigin;
  }

  // Some deploys accidentally store a concatenated value like
  // "https://frontend.app/https://backend.up.railway.app".
  // Prefer the last valid origin in that case.
  const origins = Array.from(new Set((candidate.match(/https?:\/\/[^/\s]+/gi) || []).map(origin => origin.replace(/\/$/, ''))));
  if (origins.length > 1) {
    return origins[origins.length - 1];
  }

  try {
    const parsed = new URL(candidate);

    // If the env var is pointing at the current Vercel host, keep the same origin
    // so the Vercel rewrite can handle /api/* requests safely.
    if (currentOrigin && (parsed.origin === currentOrigin || candidate.includes(currentOrigin))) {
      return currentOrigin;
    }

    return parsed.origin;
  } catch {
    return candidate.startsWith('http://') || candidate.startsWith('https://')
      ? candidate
      : `https://${candidate}`;
  }
}
