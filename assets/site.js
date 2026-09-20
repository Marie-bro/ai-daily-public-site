(() => {
  const root = document.documentElement.dataset.root || "./";
  const page = document.documentElement.dataset.page;
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const categoryLabels = {
    ai: "AI", chips: "芯片", consumer_tech: "消费科技", software: "软件",
    robotics: "机器人", mobility: "智能出行", space: "航天", science: "科学",
    internet: "互联网", other_tech: "其他科技"
  };
  const reportHref = (date) => `${root}daily/ai/?date=${encodeURIComponent(date)}`;
  const formatDate = (date) => new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date(`${date}T12:00:00+08:00`));
  const getJson = async (path) => {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };
  const techReports = (index) => Array.isArray(index.reports)
    ? index.reports.filter((report) => ["tech", "ai"].includes(report.category) && report.article_count > 0 && /^\d{4}-\d{2}-\d{2}$/.test(report.report_date)).sort((a, b) => b.report_date.localeCompare(a.report_date))
    : [];
  const latestReport = (index) => techReports(index)[0];
  const todayInShanghai = () => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const value = (type) => parts.find((part) => part.type === type).value;
    return `${value("year")}-${value("month")}-${value("day")}`;
  };
  const setFailure = (target, text) => { target.replaceChildren(element("p", text, "notice")); };
  const favoriteStorageKey = "mariespace-tech-daily-favorites-v1";
  const feishuSdkUrl = "https://lf1-cdn-tos.bytegoofy.com/obj/feishu-static/lark/h5-js-sdk-1.5.23.js";
  let feishuSdkPromise;
  const favoriteArticle = (item) => ({
    title_en: item.title_en || item.title_original,
    title_zh: item.title_zh || item.title_cn,
    what_happened_en: item.what_happened_en || item.summary_en,
    what_happened_zh: item.what_happened_zh || item.what_happened || item.summary_cn,
    why_it_matters_en: item.why_it_matters_en || item.relevance,
    why_it_matters_zh: item.why_it_matters_zh || item.why_it_matters,
    source: item.source, published_at: item.published_at, original_url: item.original_url,
  });
  const localKey = (article) => article.original_url.replace(/#.*/, "");
  const localFavorites = () => {
    try { const entries = JSON.parse(localStorage.getItem(favoriteStorageKey) || "[]"); return Array.isArray(entries) ? entries : []; } catch { return []; }
  };
  const saveLocalFavorite = (article) => {
    const entries = localFavorites();
    if (entries.some((entry) => entry.original_url === localKey(article))) return "already_saved";
    entries.unshift({ ...article, original_url: localKey(article), saved_at: new Date().toISOString() });
    localStorage.setItem(favoriteStorageKey, JSON.stringify(entries));
    return "saved_locally";
  };
  const ensureFeishuSdk = () => {
    if (window.h5sdk && window.tt?.requestAuthCode) return Promise.resolve();
    if (feishuSdkPromise) return feishuSdkPromise;
    feishuSdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = feishuSdkUrl; script.async = true; script.onload = resolve;
      script.onerror = () => reject(new Error("feishu_sdk_unavailable")); document.head.append(script);
    });
    return feishuSdkPromise;
  };
  const requestFeishuCode = async () => {
    await ensureFeishuSdk();
    const config = await getJson(`${root}api/favorites/config`);
    if (!config.app_id || !window.h5sdk || !window.tt?.requestAuthCode) throw new Error("feishu_identity_unavailable");
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("feishu_identity_timeout")), 8000);
      window.h5sdk.ready(() => window.tt.requestAuthCode({ appId: config.app_id,
        success: (result) => { window.clearTimeout(timeout); result?.code ? resolve(result.code) : reject(new Error("feishu_identity_missing")); },
        fail: () => { window.clearTimeout(timeout); reject(new Error("feishu_identity_denied")); },
      }));
    });
  };
  const saveFavorite = async (item) => {
    const article = favoriteArticle(item);
    try {
      const code = await requestFeishuCode();
      const response = await fetch(`${root}api/favorites/queue`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, article }) });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.ok) return payload.status;
      if (response.status !== 401 && response.status !== 403) throw new Error("queue_unavailable");
    } catch { /* Browsers outside Feishu and non-Owner users remain local by design. */ }
    return saveLocalFavorite(article);
  };
  const favoriteMessage = (status) => ({
    pending: "Saved\n\u5df2\u52a0\u5165\u6536\u85cf\u961f\u5217",
    already_queued: "Already saved\n\u5df2\u7ecf\u6536\u85cf",
    already_saved: "Already saved\n\u5df2\u7ecf\u6536\u85cf",
    saved_locally: "Saved locally\n\u5df2\u4fdd\u5b58\u5230\u6b64\u6d4f\u89c8\u5668",
  }[status] || "Saved locally\n\u5df2\u4fdd\u5b58\u5230\u6b64\u6d4f\u89c8\u5668");
  const favoriteControls = (item) => {
    const controls = element("div", undefined, "favorite-controls");
    const button = element("button", "Save for Later\n\u6536\u85cf", "favorite-button");
    button.type = "button";
    const status = element("p", "", "favorite-status");
    button.addEventListener("click", async () => {
      button.disabled = true; status.textContent = "Saving\n\u6b63\u5728\u6536\u85cf";
      status.textContent = favoriteMessage(await saveFavorite(item)); button.disabled = false;
    });
    controls.append(button, status); return controls;
  };
  const articleId = async (item) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(localKey(favoriteArticle(item))));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  };
  const displayHighlight = (highlight) => {
    const parts = String(highlight || "").split(" / ");
    return parts.length > 1 ? parts.at(-1) : parts[0];
  };
  const summaryCard = (report) => {
    const link = element("a", undefined, "report-link");
    link.href = reportHref(report.report_date);
    const title = element("h2", `${report.schema_version >= 2 || report.category === "tech" ? "Tech Daily" : "AI Daily"} · ${report.report_date}`);
    const facts = element("p", `${report.article_count} 条资讯 · 预计阅读 ${report.estimated_reading_minutes} 分钟`, "report-facts");
    const highlights = element("p", (report.highlights || []).map(displayHighlight).join(" · "), "report-highlights");
    link.append(title, facts, highlights, element("span", "阅读日报 →", "text-link"));
    return link;
  };
  const renderHome = async () => {
    const index = await getJson(`${root}data/reports.json`);
    const latest = latestReport(index);
    const report = techReports(index).find((entry) => entry.report_date === todayInShanghai());
    if (!report) {
      document.querySelector("#today-title").textContent = "今日暂无符合条件的科技资讯";
      document.querySelector("#today-date").textContent = formatDate(todayInShanghai());
      document.querySelector("#article-count").textContent = "0 条";
      document.querySelector("#reading-minutes").textContent = "—";
      document.querySelector("#today-highlight").textContent = "暂无";
      document.querySelector("#today-notice").textContent = latest ? `最新一期为 ${latest.report_date}，仍可从历史归档回看。` : "没有合格资讯时不会生成空日报。";
      document.querySelector("#today-link").href = latest ? reportHref(latest.report_date) : `${root}ai/`;
      document.querySelector("#today-link").firstChild.textContent = latest ? "阅读最近一期 " : "浏览科技频道 ";
      return;
    }
    document.querySelector("#today-title").textContent = `Tech Daily · ${report.report_date}`;
    document.querySelector("#today-date").textContent = formatDate(report.report_date);
    document.querySelector("#article-count").textContent = `${report.article_count} 条`;
    document.querySelector("#reading-minutes").textContent = `${report.estimated_reading_minutes} 分钟`;
    document.querySelector("#today-highlight").textContent = displayHighlight((report.highlights || ["已发布"])[0]);
    document.querySelector("#today-notice").textContent = "广泛采集、严格筛选；每条资讯均保留可追溯原文。";
    document.querySelector("#today-link").href = reportHref(report.report_date);
    document.querySelector("#archive-preview-title").textContent = `最近日报：${report.report_date}`;
    document.querySelector("#archive-preview-copy").textContent = `${report.article_count} 条已验证科技资讯，预计阅读 ${report.estimated_reading_minutes} 分钟。`;
  };
  const renderReportList = async (target) => {
    const reports = techReports(await getJson(`${root}data/reports.json`));
    if (!reports.length) return setFailure(target, "暂无已验证日报。新的日报发布后会在这里按日期保存。");
    target.replaceChildren(...reports.map(summaryCard));
  };
  const contentSection = (heading, english, chinese) => {
    const section = element("section", undefined, "article-section");
    section.append(element("h3", heading));
    if (english) section.append(element("p", english, "content-en"));
    if (chinese) section.append(element("p", chinese, "content-zh"));
    return section;
  };
  const sourceHeader = (item, titleEn, titleZh) => {
    const header = element("header", undefined, "article-header");
    if (item.category) header.append(element("span", categoryLabels[item.category] || "科技", "category-badge"));
    if (titleEn) header.append(element("h2", titleEn, "content-en"));
    if (titleZh) header.append(element("p", titleZh, "article-title-cn content-zh"));
    const meta = element("p", `原始来源：${item.source} · 发布：${new Date(item.published_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}`, "article-meta");
    const originalUrl = element("p", undefined, "original-url");
    originalUrl.append(element("strong", "原始链接："), element("span", item.original_url));
    const sourceLink = element("a", "查看原文 →", "source-link");
    const parsedUrl = new URL(item.original_url);
    if (parsedUrl.protocol !== "https:") throw new Error("Invalid original URL");
    sourceLink.href = parsedUrl.href;
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    header.append(meta, originalUrl, sourceLink);
    return header;
  };
  const renderArticle = (item, schemaVersion) => {
    const article = element("article", undefined, "daily-article");
    const titleEn = item.title_en || item.title_original;
    const titleZh = item.title_cn;
    article.append(sourceHeader(item, titleEn, titleZh));
    const happenedEn = item.what_happened_en || item.summary_en;
    const happenedZh = item.what_happened || item.summary_cn;
    const whyEn = item.why_it_matters_en || item.relevance;
    const whyZh = item.why_it_matters;
    if (happenedEn || happenedZh) article.append(contentSection("What happened?", happenedEn, happenedZh));
    if (whyEn || whyZh) article.append(contentSection("Why it matters?", whyEn, whyZh));
    article.append(favoriteControls(item));
    return article;
  };
  const renderDaily = async () => {
    const params = new URLSearchParams(window.location.search);
    let date = params.get("date");
    if (!date) date = latestReport(await getJson(`${root}data/reports.json`))?.report_date;
    if (!date) {
      document.querySelector("#report-title").textContent = "今日暂无符合条件的科技资讯";
      document.querySelector("#daily-report").replaceChildren(element("p", "没有合格资讯时不会生成空日报；历史日报仍可按日期回看。", "notice"));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid report date");
    const report = await getJson(`${root}data/daily/ai/${date}.json`);
    if (report.report_date !== date || !Array.isArray(report.items) || !report.items.length) throw new Error("Invalid report data");
    const name = report.schema_version >= 2 || report.category === "tech" ? "Tech Daily" : "AI Daily";
    document.title = `${name} · ${report.report_date}`;
    document.querySelector("#report-title").textContent = `${name} · ${report.report_date}`;
    document.querySelector("#report-meta").textContent = `${report.article_count} 条资讯 · 预计阅读 ${report.estimated_reading_minutes} 分钟 · ${formatDate(report.report_date)}`;
    document.querySelector("#daily-report").replaceChildren(...report.items.map((item) => renderArticle(item, report.schema_version || 1)));
    const requestedFavorite = params.get("favorite");
    if (/^[a-f0-9]{64}$/.test(requestedFavorite || "")) {
      const matches = await Promise.all(report.items.map(async (item) => ({ item, id: await articleId(item) })));
      const selected = matches.find((entry) => entry.id === requestedFavorite)?.item;
      if (selected) {
        document.querySelector(".report-header").append(element("p", favoriteMessage(await saveFavorite(selected)), "favorite-status"));
        history.replaceState({}, "", reportHref(date));
      }
    }
  };
  const renderFavorites = () => {
    const target = document.querySelector("#favorite-list");
    const entries = localFavorites();
    if (!entries.length) return setFailure(target, "\u6b64\u6d4f\u89c8\u5668\u8fd8\u6ca1\u6709\u672c\u5730\u6536\u85cf\u3002\nNo local favorites are saved in this browser yet.");
    target.replaceChildren(...entries.map((item) => renderArticle(item, 3)));
  };
  const run = async () => {
    try {
      if (page === "home") await renderHome();
      if (page === "channel") await renderReportList(document.querySelector("#channel-reports"));
      if (page === "archive") await renderReportList(document.querySelector("#archive-reports"));
      if (page === "daily") await renderDaily();
      if (page === "favorites") renderFavorites();
    } catch {
      const target = document.querySelector("#daily-report, #channel-reports, #archive-reports, #favorite-list, #today-notice");
      if (target) setFailure(target, "日报暂时无法载入，请稍后重试。");
    }
  };
  run();
})();
