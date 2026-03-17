import { format, fromUnixTime } from "date-fns";

/**
 * Format a file size in bytes to a human-readable string.
 */
export function formatFileSize(bytes: bigint): string {
  const size = Number(bytes);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024)
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Convert ICP nanosecond timestamp to JavaScript Date
 */
export function fromNanoseconds(timestamp: bigint): Date {
  return fromUnixTime(Number(timestamp) / 1_000_000_000);
}

/**
 * Format a nanosecond timestamp to a human-readable date string.
 * @param timestamp - Nanosecond timestamp (bigint)
 * @param includeTime - Whether to include hours and minutes (default: false)
 */
export function formatDate(timestamp: bigint, includeTime = false): string {
  const date = fromNanoseconds(timestamp);
  return includeTime
    ? format(date, "MMM d, yyyy h:mm a")
    : format(date, "MMM d, yyyy");
}
