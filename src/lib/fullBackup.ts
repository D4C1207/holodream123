export type FullBackupPayload = {
  schema: "d4c-holodream-backup-v1";
  exportedAt: string;
  origin: string;
  items: Record<string, string>;
};

const PREFIX = "holodream-";

export function createFullBackup(): FullBackupPayload {
  const items: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(PREFIX)) continue;
    const value = localStorage.getItem(key);
    if (value != null) items[key] = value;
  }
  return {
    schema: "d4c-holodream-backup-v1",
    exportedAt: new Date().toISOString(),
    origin: location.origin + location.pathname,
    items,
  };
}

export function stringifyFullBackup(): string {
  return JSON.stringify(createFullBackup(), null, 2);
}

export function restoreFullBackup(text: string): number {
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") throw new Error("invalid backup");
  const payload = parsed as Partial<FullBackupPayload>;
  if (payload.schema !== "d4c-holodream-backup-v1") throw new Error("unsupported backup schema");
  if (!payload.items || typeof payload.items !== "object") throw new Error("invalid backup items");

  const entries = Object.entries(payload.items).filter(
    ([key, value]) => key.startsWith(PREFIX) && typeof value === "string",
  );
  if (!entries.length) throw new Error("empty backup");

  const currentKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) currentKeys.push(key);
  }
  for (const key of currentKeys) localStorage.removeItem(key);
  for (const [key, value] of entries) localStorage.setItem(key, value);
  return entries.length;
}
