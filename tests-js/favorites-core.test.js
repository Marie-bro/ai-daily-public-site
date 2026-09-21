import assert from "node:assert/strict";
import test from "node:test";
import { handleFavorites, normalizeArticle } from "../edge-functions/_lib/favorites-core.js";

const article = {
  title_en: "English title",
  title_cn: "中文标题",
  what_happened_en: "English event summary.",
  what_happened: "中文事件摘要。",
  why_it_matters_en: "English importance.",
  why_it_matters: "中文重要性。",
  source: "Official Source",
  published_at: "2026-09-20T00:00:00+00:00",
  original_url: "https://example.com/story#fragment",
};

class Store {
  constructor() { this.values = new Map(); }
  async get(key) { return this.values.get(key) ?? null; }
  async setJSON(key, value, options = {}) {
    if (options.onlyIfNew && this.values.has(key)) throw new Error("exists");
    this.values.set(key, structuredClone(value));
  }
  async list({ prefix }) { return { blobs: [...this.values.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key, etag: "test" })) }; }
}

const config = { appId: "cli_test", appSecret: "secret", ownerId: "ou_owner", workerToken: "worker-secret" };
const fetcher = async (url) => {
  if (url.includes("app_access_token")) return Response.json({ code: 0, app_access_token: "app-token" });
  return Response.json({ code: 0, data: { open_id: "ou_owner" } });
};
const unauthorizedFetcher = async (url) => url.includes("app_access_token")
  ? Response.json({ code: 0, app_access_token: "app-token" })
  : Response.json({ code: 0, data: { open_id: "ou_not_owner" } });
const deps = (store, options = {}) => ({ store, fetcher: options.fetcher || fetcher, config, now: () => new Date("2026-09-21T00:00:00Z") });
const context = (action, body, headers = {}) => ({ params: { action }, request: new Request(`https://news.mariespace.cn/api/favorites/${action}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined }) });

async function response(result) { return { status: result.status, body: await result.json() }; }

test("normalizes a public article into a stable, complete favorite record", async () => {
  const result = await normalizeArticle(article);
  assert.match(result.article_id, /^[a-f0-9]{64}$/);
  assert.equal(result.original_url, "https://example.com/story");
  assert.equal(result.title_zh, "中文标题");
});

test("owner queue requires Feishu-backed identity and deduplicates by normalized source URL", async () => {
  const store = new Store();
  const first = await response(await handleFavorites(context("queue", { code: "one-time-code", article }), deps(store)));
  assert.equal(first.status, 201);
  assert.equal(first.body.status, "pending");
  assert.equal(store.values.size, 1);
  const job = [...store.values.values()][0];
  assert.equal(job.status, "pending");
  assert.equal(job.requested_by, "owner");
  assert.equal(job.title_en, "English title");
  const second = await response(await handleFavorites(context("queue", { code: "another-code", article: { ...article, original_url: "https://example.com/story" } }), deps(store)));
  assert.equal(second.status, 200);
  assert.equal(second.body.status, "already_queued");
  assert.equal(store.values.size, 1);
});

test("non-owner Feishu identity is forbidden and never creates a queue task", async () => {
  const store = new Store();
  const result = await response(await handleFavorites(context("queue", { code: "not-owner", article }), deps(store, { fetcher: unauthorizedFetcher })));
  assert.equal(result.status, 403);
  assert.equal(result.body.code, "owner_required");
  assert.equal(store.values.size, 0);
});

test("worker pulls, completes, and is rejected without its separate token", async () => {
  const store = new Store();
  await handleFavorites(context("queue", { code: "owner", article }), deps(store));
  const denied = await response(await handleFavorites(context("claim"), deps(store)));
  assert.equal(denied.status, 403);
  const claimed = await response(await handleFavorites(context("claim", null, { authorization: "Bearer worker-secret" }), deps(store)));
  assert.equal(claimed.status, 200);
  assert.equal(claimed.body.job.status, "processing");
  const completed = await response(await handleFavorites(context("complete", { article_id: claimed.body.job.article_id, lease_id: claimed.body.job.lease_id, status: "completed" }, { authorization: "Bearer worker-secret" }), deps(store)));
  assert.equal(completed.status, 200);
  assert.equal(completed.body.status, "completed");
  const job = [...store.values.values()][0];
  assert.equal(job.status, "completed");
  assert.equal(job.lease_id, undefined);
});

test("worker status reveals queue counts only and requires its separate token", async () => {
  const store = new Store();
  await handleFavorites(context("queue", { code: "owner", article }), deps(store));
  const denied = await response(await handleFavorites(context("status"), deps(store)));
  assert.equal(denied.status, 403);
  const result = await response(await handleFavorites(context("status", null, { authorization: "Bearer worker-secret" }), deps(store)));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.queue, { pending: 1, processing: 0, completed: 0, failed: 0, total: 1 });
});
