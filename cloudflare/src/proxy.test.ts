import assert from "node:assert/strict";
import test from "node:test";
import { forwardedHeaders, targetUrl } from "./proxy.ts";

test("proxy keeps the path and tells the engine the public host", () => {
  const request = new Request("http://127.0.0.1:8787/api/editor/load?x=1", { method: "POST" });
  assert.equal(targetUrl("http://127.0.0.1:8080", request.url), "http://127.0.0.1:8080/api/editor/load?x=1");
  const headers = forwardedHeaders(request);
  assert.equal(headers.get("X-Forwarded-Host"), "127.0.0.1:8787");
  assert.equal(headers.get("X-Forwarded-Proto"), "http");
  assert.equal(headers.get("host"), null);
});
