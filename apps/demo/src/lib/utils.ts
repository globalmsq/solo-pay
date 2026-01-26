/**
 * Utility functions for the demo app
 */

/**
 * Truncate an address to show first 6 and last 4 characters
 * @example truncateAddress("0x1234567890abcdef1234567890abcdef12345678") => "0x1234...5678"
 */
export function truncateAddress(addr: string | undefined | null): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/**
 * Truncate a hash (transaction hash, payment ID, etc.)
 * @example truncateHash("0xabcdef...") => "0xabcdef12...3456abcd"
 */
export function truncateHash(
  hash: string | undefined | null,
  prefixLen = 10,
  suffixLen = 8
): string {
  if (!hash) return '';
  if (hash.length <= prefixLen + suffixLen) {
    return hash;
  }
  return `${hash.slice(0, prefixLen)}...${hash.slice(-suffixLen)}`;
}

/**
 * Format a Unix timestamp to a readable date and time string
 * @param timestamp Unix timestamp in seconds (as string)
 */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(parseInt(timestamp) * 1000);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}
