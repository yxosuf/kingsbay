/**
 * Shared helper for applying property-scoped filters to Supabase queries.
 *
 * Replaces the ~20 occurrences of:
 *   if (propertyId && !showAllProperties) query = query.eq('property_id', propertyId);
 */

/**
 * Narrow a Supabase query to a single property when applicable.
 * Returns the (possibly filtered) query – always safe to chain.
 */
export function applyPropertyFilter<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  propertyId: string | null | undefined,
  showAllProperties: boolean,
): T {
  if (!showAllProperties && propertyId) {
    return query.eq('property_id', propertyId);
  }
  return query;
}
