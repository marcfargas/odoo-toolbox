export const DEFAULT_SEARCH_LIMIT = 100;
export const MAX_SEARCH_LIMIT = 500;
export const MAX_RESPONSE_BYTES = 512 * 1024;

export interface PaginationInfo {
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export function enforceLimit(
  limit: unknown,
  defaultLimit: number = DEFAULT_SEARCH_LIMIT,
  maxLimit: number = MAX_SEARCH_LIMIT
): number {
  if (typeof limit !== 'number' || Number.isNaN(limit)) {
    return defaultLimit;
  }

  const integerLimit = Math.trunc(limit);

  if (integerLimit < 1) return 1;
  if (integerLimit > maxLimit) return maxLimit;

  return integerLimit;
}

export function enforceOffset(offset: unknown): number {
  if (typeof offset !== 'number' || Number.isNaN(offset)) {
    return 0;
  }

  const integerOffset = Math.trunc(offset);
  return integerOffset < 0 ? 0 : integerOffset;
}

export function buildPagination(
  total: number,
  offset: number,
  limit: number,
  count: number
): PaginationInfo {
  return {
    total,
    offset,
    limit,
    hasMore: offset + count < total,
  };
}

export function getPayloadBytes(payload: unknown): number {
  return Buffer.byteLength(JSON.stringify(payload), 'utf8');
}

export function isPayloadOversize(payload: unknown): { oversize: boolean; bytes: number } {
  const bytes = getPayloadBytes(payload);
  return { oversize: bytes > MAX_RESPONSE_BYTES, bytes };
}
