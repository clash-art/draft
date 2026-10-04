const KEY_RE = /^(credentials\.json|workspace\/[A-Za-z0-9._/-]+)$/;
const BLOCKED = new Set([
  "workspace/.workspace.lock",
  "workspace/mcp-status.json",
  "workspace/app-host.json",
  "workspace/.sync-base.json",
]);

export function validSyncKey(key: string, includeSecrets = true): boolean {
  if (!KEY_RE.test(key)) return false;
  const parts = key.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) return false;
  if (key === "credentials.json") return includeSecrets;
  if (BLOCKED.has(key)) return false;
  if (key.startsWith("workspace/xiaohongshu-profile/") || key.startsWith("workspace/sync-conflicts/")) return false;
  return true;
}

export function presentedToken(headers: Headers): string {
  const authorization = headers.get("Authorization") || "";
  if (authorization.toLowerCase().startsWith("bearer ")) return authorization.slice(7).trim();
  return (headers.get("X-Config-Token") || "").trim();
}

export async function tokenMatches(presented: string, expected: string): Promise<boolean> {
  if (!expected || expected.length < 32 || !presented) return false;
  const encoder = new TextEncoder();
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(presented)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(leftDigest);
  const right = new Uint8Array(rightDigest);
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left[index] ^ right[index];
  return diff === 0;
}

export function originAllowed(origin: string | null, expectedOrigin: string): boolean {
  if (!origin) return true;
  return origin === expectedOrigin;
}

export function serverTokenReady(token: string | undefined): token is string {
  return typeof token === "string" && token.length >= 32;
}
