/**
 * Shared CDS Hooks utility helpers used across hook handlers.
 */

/**
 * Extracts FHIR resources from a prefetch value which may be a Bundle,
 * a single resource, or absent. Optionally filters by resourceType.
 */
export function extractBundleResources(
  prefetchValue: unknown,
  expectedType?: string,
): Array<Record<string, unknown>> {
  if (!prefetchValue || typeof prefetchValue !== 'object') return [];
  const obj = prefetchValue as Record<string, unknown>;
  if (obj.resourceType === 'Bundle') {
    const entry = (obj.entry as Array<{ resource?: Record<string, unknown> }> | undefined) ?? [];
    const resources = entry.map((e) => e.resource).filter(Boolean) as Array<Record<string, unknown>>;
    if (!expectedType) return resources;
    return resources.filter((r) => r.resourceType === expectedType);
  }
  if (obj.resourceType) {
    if (!expectedType || obj.resourceType === expectedType) return [obj as Record<string, unknown>];
    return [];
  }
  return [];
}

/** Strips a leading "Patient/" prefix from a patient ID string. */
export function stripPatientPrefix(id: string): string {
  if (id.startsWith('Patient/')) return id.slice('Patient/'.length);
  return id;
}

/** Reads the USE_ELM environment variable and returns true when set to "true" (case-insensitive). */
export function getUseElm(): boolean {
  return String(process.env.USE_ELM ?? 'false').toLowerCase() === 'true';
}

/** Returns a concise error message string from any thrown value. */
export function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
