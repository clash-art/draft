import { originAllowed, presentedToken, serverTokenReady, tokenMatches } from "./auth";
import { forwardedHeaders, targetUrl } from "./proxy";
import { handleSync } from "./sync_api";
import tokenGate from "../token-gate.js";

export interface Env {
  DRAFT_ACCESS_TOKEN?: string;
  DRAFT_DEV_ORIGIN?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
  DRAFT_BUCKET: R2Bucket;
  ASSETS: Fetcher;
  DRAFT_CONTAINER?: { getByName(name: string): { fetch(request: Request): Promise<Response> } };
}

const SECURITY: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; img-src 'self' data: https://mmbiz.qpic.cn https://mmbiz.qlogo.cn; frame-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};

export async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/health") return new Response("ok", { headers: { "Cache-Control": "no-store" } });
  if (request.method === "GET" && (url.pathname === "/" || url.pathname.startsWith("/ui/"))) return asset(request, env);
  if (!serverTokenReady(env.DRAFT_ACCESS_TOKEN)) return json({ error: "云端访问令牌未配置" }, 503);
  if (!(await tokenMatches(presentedToken(request.headers), env.DRAFT_ACCESS_TOKEN))) return json({ error: "需要访问令牌。" }, 401);
  if (!originAllowed(request.headers.get("Origin"), url.origin)) return json({ error: "页面来源不被接受。" }, 403);
  if (url.pathname === "/sync/manifest" || url.pathname === "/sync/object") return handleSync(request, env);
  if (url.pathname.startsWith("/api/") || url.pathname === "/api" || url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
    return remote(request, env);
  }
  return json({ error: "不存在的页面" }, 404);
}

async function asset(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname.includes("..")) return json({ error: "资源不存在" }, 404);
  const path = url.pathname === "/" ? "/ui/index.html" : url.pathname;
  const response = await env.ASSETS.fetch(new Request(new URL(path, url.origin), request));
  if (!response.ok) return json({ error: "资源不存在" }, response.status);
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY)) headers.set(name, value);
  const type = headers.get("Content-Type") || "";
  if (!type.includes("text/html") && !path.endsWith(".html") && path !== "/ui/index.html") {
    return new Response(response.body, { status: response.status, headers });
  }
  const html = (await response.text()).replace("</body>", `<script id="draft-token-gate">${tokenGate}</script></body>`);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.delete("Content-Length");
  return new Response(html, { status: response.status, headers });
}

async function remote(request: Request, env: Env): Promise<Response> {
  if (env.DRAFT_DEV_ORIGIN) {
    const headers = forwardedHeaders(request);
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
    return fetch(targetUrl(env.DRAFT_DEV_ORIGIN, request.url), { method: request.method, headers, body, redirect: "manual" });
  }
  if (env.DRAFT_CONTAINER) return env.DRAFT_CONTAINER.getByName("owner").fetch(request);
  return json({ error: "远程引擎未配置。同步接口仍然可用；插件请继续使用本机服务。" }, 503);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
