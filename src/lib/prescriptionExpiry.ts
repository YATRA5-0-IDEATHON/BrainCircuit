export function parseDurationToDays(duration: string): number | null {
  if (!duration) return null;
  const match = duration.match(/(\d+)\s*(day|days|week|weeks|month|months)/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("day")) return value;
  if (unit.startsWith("week")) return value * 7;
  if (unit.startsWith("month")) return value * 30;
  return null;
}

export function getPrescriptionEndDate(
  createdAt: string | Date,
  items: { duration: string }[],
): Date | null {
  const createdMs = new Date(createdAt).getTime();
  let latestEndMs: number | null = null;

  for (const item of items) {
    const days = parseDurationToDays(item.duration);
    if (days === null) continue;
    const endMs = createdMs + days * 24 * 60 * 60 * 1000;
    if (latestEndMs === null || endMs > latestEndMs) {
      latestEndMs = endMs;
    }
  }

  return latestEndMs !== null ? new Date(latestEndMs) : null;
}

export function isPrescriptionExpired(
  createdAt: string | Date,
  items: { duration: string }[],
): boolean {
  const endDate = getPrescriptionEndDate(createdAt, items);
  if (!endDate) return false;
  return endDate.getTime() < Date.now();
}