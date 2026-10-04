import { serverTokenReady, validSyncKey } from "./auth";

const PREFIX = "v1/";
const MAX_BYTES = 12 * 1024 * 1024;

export interface SyncEnv {
  DRAFT_BUCKET: R2Bucket;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function handleSync(request: Request, env: SyncEnv): Promise<Response> {
  if (!env.DRAFT_BUCKET) return json({ error: "云端存储未配置" }, 503);
  const url = new URL(request.url);
  if (url.pathname === "/sync/manifest" && request.method === "GET") return manifest(env);
  if (url.pathname === "/sync/object") {
    const key = url.searchParams.get("key") || "";
    if (!validSyncKey(key, true)) return json({ error: "同步路径无效" }, 400);
    if (request.method === "GET") return readObject(env, key);
    if (request.method === "PUT") return writeObject(request, env, key);
    if (request.method === "DELETE") return deleteObject(env, key);
  }
  return json({ error: "不存在的接口" }, 404);
}

async function manifest(env: SyncEnv): Promise<Response> {
  const files: { key: string; sha256: string; size: number }[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.DRAFT_BUCKET.list({ prefix: PREFIX, cursor, limit: 1000 });
    for (const object of page.objects) {
      const key = object.key.startsWith(PREFIX) ? object.key.slice(PREFIX.length) : "";
      if (!validSyncKey(key, true)) continue;
      let digest = object.customMetadata?.sha256;
      if (!digest) {
        const stored = await env.DRAFT_BUCKET.get(object.key);
        if (!stored) continue;
        digest = await sha256Hex(await stored.arrayBuffer());
      }
      files.push({ key, sha256: digest, size: object.size });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return json({ files });
}

async function readObject(env: SyncEnv, key: string): Promise<Response> {
  const stored = await env.DRAFT_BUCKET.get(PREFIX + key);
  if (!stored) return json({ error: "云端没有这个文件" }, 404);
  const bytes = await stored.arrayBuffer();
  const digest = await sha256Hex(bytes);
  return new Response(bytes, {
    headers: { "X-Content-Sha256": digest, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

async function writeObject(request: Request, env: SyncEnv, key: string): Promise<Response> {
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return json({ error: "对象大小无效" }, 400);
  const digest = await sha256Hex(bytes);
  if (request.headers.get("X-Content-Sha256") !== digest) return json({ error: "校验不一致" }, 400);
  await env.DRAFT_BUCKET.put(PREFIX + key, bytes, { customMetadata: { sha256: digest } });
  return json({ key, sha256: digest, size: bytes.byteLength });
}

async function deleteObject(env: SyncEnv, key: string): Promise<Response> {
  await env.DRAFT_BUCKET.delete(PREFIX + key);
  return json({ deleted: true });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export function assertTokenReady(token: string | undefined): boolean {
  return serverTokenReady(token);
}
