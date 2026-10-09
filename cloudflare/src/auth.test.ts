import assert from "node:assert/strict";
import test from "node:test";
import { originAllowed, presentedToken, tokenMatches, validSyncKey } from "./auth.ts";

test("sync keys match the local engine", () => {
  assert.equal(validSyncKey("credentials.json"), true);
  assert.equal(validSyncKey("credentials.json", false), false);
  assert.equal(validSyncKey("workspace/editor.json"), true);
  assert.equal(validSyncKey("workspace/images/0123456789abcdef0123456789abcdef.png"), true);
  assert.equal(validSyncKey("workspace/../credentials.json"), false);
  assert.equal(validSyncKey("../x"), false);
  assert.equal(validSyncKey("workspace/xiaohongshu-profile/Cookies"), false);
  assert.equal(validSyncKey("workspace/.workspace.lock"), false);
  assert.equal(validSyncKey("workspace/mcp-status.json"), false);
  assert.equal(validSyncKey("sync-base.json"), false);
});

test("token comparison rejects short and wrong secrets", async () => {
  const secret = "local-test-token-0123456789abcdef";
  assert.equal(await tokenMatches(secret, secret), true);
  assert.equal(await tokenMatches(secret + "x", secret), false);
  assert.equal(await tokenMatches("", secret), false);
  assert.equal(await tokenMatches(secret, "short"), false);
});

test("browser and plugin present the same token", () => {
  assert.equal(presentedToken(new Headers({ Authorization: "Bearer abc" })), "abc");
  assert.equal(presentedToken(new Headers({ "X-Config-Token": "from-page" })), "from-page");
  assert.equal(originAllowed(null, "https://draft.example"), true);
  assert.equal(originAllowed("https://draft.example", "https://draft.example"), true);
  assert.equal(originAllowed("https://evil.example", "https://draft.example"), false);
});
