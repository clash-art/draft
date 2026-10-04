import { DurableObject } from "cloudflare:workers";
import type { Env } from "./handler";

const IDLE_MS = 10 * 60 * 1000;

interface CloudContainer {
  running: boolean;
  images: { base: unknown };
  start(options: Record<string, unknown>): void;
  setInactivityTimeout(ms: number): Promise<void>;
  getTcpPort(port: number): { fetch(request: Request): Promise<Response> };
}

export class DraftContainer extends DurableObject<Env> {
  private starting: Promise<void> | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const origin = new URL(request.url).origin;
    this.starting ??= this.start(origin).finally(() => {
      this.starting = undefined;
    });
    await this.starting;
    const url = new URL(request.url);
    url.protocol = "http:";
    url.host = "container";
    const headers = new Headers(request.headers);
    headers.set("X-Forwarded-Host", new URL(request.url).host);
    headers.set("X-Forwarded-Proto", new URL(request.url).protocol.replace(":", ""));
    headers.delete("host");
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
    return this.runtime().getTcpPort(8080).fetch(new Request(url, { method: request.method, headers, body }));
  }

  private runtime(): CloudContainer {
    const runtime = this.ctx as DurableObjectState & { container?: CloudContainer };
    if (!runtime.container) throw new Error("container runtime missing");
    return runtime.container;
  }

  private async start(origin: string): Promise<void> {
    const container = this.runtime();
    if (!container.running) {
      const env: Record<string, string> = {
        PORT: "8080",
        DRAFT_HOSTED: "1",
        DRAFT_TRUST_PROXY: "1",
        DRAFT_XHS_BROWSER: "disabled",
        DRAFT_ACCESS_TOKEN: this.env.DRAFT_ACCESS_TOKEN || "",
        WECHAT_CONFIG_PATH: "/data/credentials.json",
        DRAFT_STATE_DIR: "/data",
        DRAFT_PUBLIC_ORIGIN: origin,
      };
      for (const name of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const) {
        const value = this.env[name];
        if (value) env[name] = value;
      }
      container.start({
        image: container.images.base,
        instance: "basic",
        enableInternet: true,
        env,
      });
    }
    await container.setInactivityTimeout(IDLE_MS);
    const port = container.getTcpPort(8080);
    let lastError: unknown;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        const response = await port.fetch("http://container/health", { signal: AbortSignal.timeout(1000) });
        await response.body?.cancel();
        if (!response.ok) throw new Error(`health ${response.status}`);
        return;
      } catch (error) {
        lastError = error;
        await scheduler.wait(200);
      }
    }
    throw new Error("fallback engine did not become ready", { cause: lastError });
  }
}
