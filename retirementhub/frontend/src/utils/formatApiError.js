/** Short API error for display; use apiErrorDebug() for structured details. */
export function formatApiError(err, fallback = 'Request failed') {
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;
  const parts = [data.error || fallback];
  if (data.operation) parts.push(`Operation: ${data.operation}`);
  return parts.join('\n');
}

export function apiErrorDebug(err) {
  const data = err?.response?.data;
  if (!data?.debug && !data?.postgres) return null;
  return { operation: data.operation, debug: data.debug, postgres: data.postgres };
}
