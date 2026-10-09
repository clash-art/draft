export function targetUrl(origin: string, requestUrl: string): string {
  const incoming = new URL(requestUrl);
  const base = new URL(origin);
  const target = new URL(incoming.pathname + incoming.search, base);
  return target.toString();
}

export function forwardedHeaders(request: Request): Headers {
  const incoming = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.set("X-Forwarded-Host", incoming.host);
  headers.set("X-Forwarded-Proto", incoming.protocol.replace(":", ""));
  headers.delete("host");
  return headers;
}
