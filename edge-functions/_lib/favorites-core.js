const MAX_TEXT = 6000;
const PROCESSING_LEASE_MS = 10 * 60 * 1000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function error(status, code) {
  return json({ ok: false, code }, status);
}

function text(value, name, max = MAX_TEXT) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`invalid_${name}`);
  return value.trim();
}

export async function normalizeArticle(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("invalid_article");
  const originalUrl = new URL(text(input.original_url, "original_url", 2048));
  if (originalUrl.protocol !== "https:") throw new Error("invalid_original_url");
  originalUrl.hash = "";
  const normalizedOriginalUrl = originalUrl.toString();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalizedOriginalUrl));
  const articleId = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return {
    article_id: articleId,
    title_en: text(input.title_en, "title_en", 512),
    title_zh: text(input.title_zh ?? input.title_cn, "title_zh", 512),
    what_happened_en: text(input.what_happened_en, "what_happened_en"),
    what_happened_zh: text(input.what_happened_zh ?? input.what_happened, "what_happened_zh"),
    why_it_matters_en: text(input.why_it_matters_en, "why_it_matters_en"),
    why_it_matters_zh: text(input.why_it_matters_zh ?? input.why_it_matters, "why_it_matters_zh"),
    source: text(input.source, "source", 512),
    published_at: text(input.published_at, "published_at", 128),
    original_url: normalizedOriginalUrl,
  };
}

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("invalid_json");
  }
}

function equalSecret(received, expected) {
  if (!expected || typeof received !== "string") return false;
  if (received.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < received.length; index += 1) difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

function workerAuthorized(request, config) {
  const authorization = request.headers.get("authorization") || "";
  return equalSecret(authorization.replace(/^Bearer\s+/i, ""), config.workerToken || "");
}

async function ownerOpenId(code, config, fetcher) {
  if (!config.appId || !config.appSecret || !config.ownerId) throw new Error("owner_auth_not_configured");
  const appResponse = await fetcher("https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: config.appId, app_secret: config.appSecret }),
  });
  const appPayload = await appResponse.json();
  const appToken = appPayload?.app_access_token;
  if (!appResponse.ok || appPayload?.code !== 0 || !appToken) throw new Error("feishu_app_auth_failed");
  const userResponse = await fetcher("https://open.feishu.cn/open-apis/authen/v1/access_token", {
    method: "POST",
    headers: { authorization: `Bearer ${appToken}`, "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ grant_type: "authorization_code", code }),
  });
  const userPayload = await userResponse.json();
  const openId = userPayload?.data?.open_id;
  if (!userResponse.ok || userPayload?.code !== 0 || !openId) throw new Error("feishu_user_auth_failed");
  return openId;
}

function keyFor(articleId) {
  return `queue/${articleId}.json`;
}

function asJob(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

async function queue(request, deps) {
  const payload = await parseJson(request);
  const code = text(payload.code, "code", 4096);
  const openId = await ownerOpenId(code, deps.config, deps.fetcher);
  if (!equalSecret(openId, deps.config.ownerId)) return error(403, "owner_required");
  const article = await normalizeArticle(payload.article);
  const key = keyFor(article.article_id);
  const existing = asJob(await deps.store.get(key, { type: "json", consistency: "strong" }));
  if (existing) return json({ ok: true, status: existing.status === "completed" ? "already_saved" : "already_queued", article_id: article.article_id });
  const requestedAt = deps.now().toISOString();
  const job = { id: `favorite_${article.article_id}`, ...article, requested_at: requestedAt, requested_by: "owner", status: "pending", attempts: 0 };
  try {
    await deps.store.setJSON(key, job, { onlyIfNew: true });
  } catch {
    // A write error is not proof of a concurrent duplicate.  Re-read before
    // telling the Feishu client that its favorite is safely queued.
    const concurrent = asJob(await deps.store.get(key, { type: "json", consistency: "strong" }));
    if (concurrent) return json({ ok: true, status: concurrent.status === "completed" ? "already_saved" : "already_queued", article_id: article.article_id });
    throw new Error("queue_store_write_failed");
  }
  return json({ ok: true, status: "pending", article_id: article.article_id }, 201);
}

async function claim(request, deps) {
  if (!workerAuthorized(request, deps.config)) return error(403, "worker_forbidden");
  const now = deps.now();
  const { blobs } = await deps.store.list({ prefix: "queue/", consistency: "strong" });
  const jobs = [];
  for (const blob of blobs) {
    const job = asJob(await deps.store.get(blob.key, { type: "json", consistency: "strong" }));
    if (!job) continue;
    const expired = job.status === "processing" && Date.parse(job.lease_expires_at || "") < now.getTime();
    if (job.status === "pending" || expired) jobs.push({ key: blob.key, job });
  }
  jobs.sort((left, right) => String(left.job.requested_at).localeCompare(String(right.job.requested_at)));
  const candidate = jobs[0];
  if (!candidate) return json({ ok: true, job: null });
  const leaseId = crypto.randomUUID();
  const claimed = { ...candidate.job, status: "processing", attempts: Number(candidate.job.attempts || 0) + 1,
    claimed_at: now.toISOString(), lease_id: leaseId, lease_expires_at: new Date(now.getTime() + PROCESSING_LEASE_MS).toISOString() };
  await deps.store.setJSON(candidate.key, claimed);
  return json({ ok: true, job: claimed });
}

async function complete(request, deps) {
  if (!workerAuthorized(request, deps.config)) return error(403, "worker_forbidden");
  const payload = await parseJson(request);
  const articleId = text(payload.article_id, "article_id", 64);
  const leaseId = text(payload.lease_id, "lease_id", 128);
  const status = payload.status === "completed" || payload.status === "failed" ? payload.status : null;
  if (!status) return error(400, "invalid_status");
  const key = keyFor(articleId);
  const job = asJob(await deps.store.get(key, { type: "json", consistency: "strong" }));
  if (!job || job.status !== "processing" || !equalSecret(job.lease_id || "", leaseId)) return error(409, "lease_conflict");
  const finished = { ...job, status, completed_at: deps.now().toISOString() };
  delete finished.lease_id;
  delete finished.lease_expires_at;
  await deps.store.setJSON(key, finished);
  return json({ ok: true, status });
}

async function queueStatus(request, deps) {
  if (!workerAuthorized(request, deps.config)) return error(403, "worker_forbidden");
  const { blobs } = await deps.store.list({ prefix: "queue/", consistency: "strong" });
  const counts = { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 };
  for (const blob of blobs) {
    const job = asJob(await deps.store.get(blob.key, { type: "json", consistency: "strong" }));
    if (!job) continue;
    counts.total += 1;
    if (Object.hasOwn(counts, job.status)) counts[job.status] += 1;
  }
  return json({ ok: true, queue: counts });
}

// Temporary Phase 6.5 diagnostic.  It uses the same Blob representation as a
// real owner task but is callable only by the existing pull Worker credential.
async function diagnosticQueue(request, deps) {
  if (!workerAuthorized(request, deps.config)) return error(403, "worker_forbidden");
  const payload = await parseJson(request);
  const article = await normalizeArticle(payload.article);
  const key = keyFor(article.article_id);
  const existing = asJob(await deps.store.get(key, { type: "json", consistency: "strong" }));
  if (existing) return json({ ok: true, task_id: existing.id, article_id: existing.article_id, requested_by: existing.requested_by, status: existing.status });
  const job = { id: `favorite_${article.article_id}`, ...article, requested_at: deps.now().toISOString(), requested_by: "owner", status: "pending", attempts: 0, diagnostic: true };
  try {
    await deps.store.setJSON(key, job, { onlyIfNew: true });
  } catch {
    const concurrent = asJob(await deps.store.get(key, { type: "json", consistency: "strong" }));
    if (concurrent) return json({ ok: true, task_id: concurrent.id, article_id: concurrent.article_id, requested_by: concurrent.requested_by, status: concurrent.status });
    throw new Error("queue_store_write_failed");
  }
  return json({ ok: true, task_id: job.id, article_id: job.article_id, requested_by: job.requested_by, status: job.status }, 201);
}

export async function handleFavorites(context, deps) {
  const request = context.request;
  const url = new URL(request.url);
  const action = context.params?.action || url.pathname.split("/").filter(Boolean).at(-1);
  if (action === "config" && request.method === "GET") return json({ app_id: deps.config.appId || "" });
  if (request.method !== "POST") return error(405, "method_not_allowed");
  try {
    if (action === "queue") return await queue(request, deps);
    if (action === "claim") return await claim(request, deps);
    if (action === "complete") return await complete(request, deps);
    if (action === "status") return await queueStatus(request, deps);
    if (action === "diagnostic-queue") return await diagnosticQueue(request, deps);
    return error(404, "not_found");
  } catch (reason) {
    const code = reason instanceof Error && /^([a-z_]+)$/.test(reason.message) ? reason.message : "request_failed";
    const status = code === "owner_required" ? 403 : code.includes("auth") ? 401 : 400;
    return error(status, code);
  }
}
