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
    internet: "互联网", other_tech: "其他科技", policy: "政策", economy: "经济",
    industry: "产业", education: "教育", employment: "就业", society: "社会趋势",
    infrastructure: "基础设施", opportunities: "未来机会"
  };
  const channelLabels = {
    technology: ["TECHNOLOGY & INDUSTRY", "科技与产业"],
    policy_economy: ["POLICY & ECONOMY", "政策与经济"],
    society_trends: ["SOCIETY & TRENDS", "社会与趋势"],
    future_opportunities: ["FUTURE OPPORTUNITIES", "未来机会"],
    explore: ["EXPLORE", "探索"],
    deep_read: ["DEEP READ", "深度阅读"],
  };
  const reportHref = (date, article) => `${root}daily/ai/?date=${encodeURIComponent(date)}${article ? `&article=${encodeURIComponent(article)}` : ""}`;
  const articleKey = (item, index) => item.article_id || `story-${index + 1}`;
  const formatDate = (date) => new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date(`${date}T12:00:00+08:00`));
  const formatPublished = (value) => new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
  const getJson = async (path) => {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };
  const radarReports = (index) => Array.isArray(index.reports)
    ? index.reports.filter((report) => ["radar", "tech", "ai"].includes(report.category) && report.article_count > 0 && /^\d{4}-\d{2}-\d{2}$/.test(report.report_date)).sort((a, b) => b.report_date.localeCompare(a.report_date))
    : [];
  const latestReport = (index) => radarReports(index)[0];
  const reportRequests = new Map();
  const getReport = (date) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Promise.reject(new Error("Invalid report date"));
    if (!reportRequests.has(date)) {
      const request = getJson(root + "data/daily/ai/" + date + ".json").then((report) => {
        if (report.report_date !== date || !Array.isArray(report.items) || !report.items.length) throw new Error("Invalid report data");
        return report;
      }).catch((error) => {
        reportRequests.delete(date);
        throw error;
      });
      reportRequests.set(date, request);
    }
    return reportRequests.get(date);
  };
  const reportRows = (report) => report.items.map((item, index) => ({
    item, key: articleKey(item, index), date: report.report_date
  }));
  const loadReports = async (editions, isCurrent) => {
    const loaded = [];
    let unavailable = 0;
    for (let offset = 0; offset < editions.length && isCurrent(); offset += 5) {
      const batch = await Promise.allSettled(editions.slice(offset, offset + 5).map((edition) => getReport(edition.report_date)));
      batch.forEach((result) => {
        if (result.status === "fulfilled") loaded.push(result.value);
        else unavailable++;
      });
    }
    return { loaded, unavailable };
  };
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
  const localKey = (article) => String(article.original_url || "").replace(/#.*/, "");
  const readingLabels = { unread: "未读", reading: "阅读中", done: "已读" };
  const readingStatus = (entry) => Object.hasOwn(readingLabels, entry.reading_status) ? entry.reading_status : "unread";
  const titleOf = (item) => item.title_zh || item.title_cn || item.title_original || item.title_en || "未命名条目";
  const localFavorites = () => {
    try { const entries = JSON.parse(localStorage.getItem(favoriteStorageKey) || "[]"); return Array.isArray(entries) ? entries.filter((entry) => entry && typeof entry.original_url === "string" && entry.original_url) : []; } catch { return []; }
  };
  const writeFavorites = (entries) => localStorage.setItem(favoriteStorageKey, JSON.stringify(entries));
  const saveLocalFavorite = (article, reference) => {
    const url = localKey(article);
    if (!url) throw new Error("missing_article_url");
    const entries = localFavorites();
    const index = entries.findIndex((entry) => localKey(entry) === url);
    if (index >= 0) {
      if (reference && !entries[index].report_date) {
        entries[index] = { ...entries[index], report_date: reference.date, article_key: reference.key };
        writeFavorites(entries);
      }
      return "already_saved";
    }
    const saved = reference ? {
      report_date: reference.date, article_key: reference.key,
      title_zh: article.title_zh, title_en: article.title_en, source: article.source,
      published_at: article.published_at
    } : article;
    entries.unshift({ ...saved, original_url: url, saved_at: new Date().toISOString() });
    writeFavorites(entries);
    return "saved_locally";
  };
  const updateReading = (url, values) => {
    const entries = localFavorites();
    const index = entries.findIndex((entry) => localKey(entry) === url);
    if (index < 0) return false;
    if (values) entries[index] = { ...entries[index], ...values };
    else entries.splice(index, 1);
    writeFavorites(entries);
    return true;
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
  const saveFavorite = async (item, reference) => {
    const article = favoriteArticle(item);
    try {
      const code = await requestFeishuCode();
      const response = await fetch(`${root}api/favorites/queue`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, article }) });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.ok) return payload.status;
      if (response.status !== 401 && response.status !== 403) throw new Error("queue_unavailable");
    } catch { /* Browsers outside Feishu and non-Owner users remain local by design. */ }
    return saveLocalFavorite(article, reference);
  };
  const favoriteMessage = (status) => ({
    pending: "Saved\n\u5df2\u52a0\u5165\u6536\u85cf\u961f\u5217",
    already_queued: "Already saved\n\u5df2\u7ecf\u6536\u85cf",
    already_saved: "Already saved\n\u5df2\u7ecf\u6536\u85cf",
    saved_locally: "Saved locally\n\u5df2\u4fdd\u5b58\u5230\u6b64\u6d4f\u89c8\u5668",
  }[status] || "Saved locally\n\u5df2\u4fdd\u5b58\u5230\u6b64\u6d4f\u89c8\u5668");
  const favoriteControls = (item, reference) => {
    const controls = element("div", undefined, "favorite-controls");
    const button = element("button", "加入我的阅读", "favorite-button");
    const status = element("p", "", "favorite-status");
    status.setAttribute("role", "status");
    button.type = "button";
    const link = element("a", "打开我的阅读 →", "source-link");
    link.href = root + "favorites/";
    const refresh = () => {
      const saved = localFavorites().find((entry) => localKey(entry) === localKey(item));
      button.textContent = saved ? "已加入我的阅读" : "加入我的阅读";
      button.setAttribute("aria-pressed", String(Boolean(saved)));
      button.disabled = Boolean(saved && (!reference || saved.report_date));
      link.hidden = !saved;
    };
    button.addEventListener("click", () => {
      try {
        const result = saveLocalFavorite(favoriteArticle(item), reference);
        status.textContent = result === "already_saved" ? "已在阅读清单里。" : "已保存到当前浏览器。";
        refresh();
      } catch {
        status.textContent = "保存失败，请检查浏览器存储权限。";
      }
    });
    controls.append(button, link, status);
    if (/Feishu|Lark/i.test(navigator.userAgent)) {
      const existing = element("button", "飞书收藏", "favorite-button reading-secondary");
      existing.type = "button";
      existing.addEventListener("click", async () => {
        existing.disabled = true;
        try { status.textContent = favoriteMessage(await saveFavorite(item, reference)); }
        catch { status.textContent = "收藏失败，请稍后重试。"; }
        finally { existing.disabled = false; refresh(); }
      });
      controls.insertBefore(existing, status);
    }
    refresh();
    return controls;
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
    const title = element("h2", `${report.category === "radar" || report.schema_version >= 3 ? "MarieSpace Radar" : report.schema_version >= 2 || report.category === "tech" ? "Tech Daily" : "AI Daily"} · ${report.report_date}`);
    const facts = element("p", `${report.article_count} 条资讯 · 预计阅读 ${report.estimated_reading_minutes} 分钟`, "report-facts");
    const highlights = element("p", (report.highlights || []).map(displayHighlight).join(" · "), "report-highlights");
    link.append(title, facts, highlights, element("span", "阅读日报 →", "text-link"));
    return link;
  };
  const renderHome = async () => {
    const index = await getJson(`${root}data/reports.json`);
    const latest = latestReport(index);
    const summary = radarReports(index).find((entry) => entry.report_date === todayInShanghai()) || latest;
    if (!summary) return setFailure(document.querySelector("#daily-report"), "暂无已验证日报。新的日报发布后会显示在这里。");
    const report = await getReport(summary.report_date);
    setReportHeader(report);
    renderDashboard(document.querySelector("#daily-report"), report);
  };
  const renderReportList = async (target) => {
    const reports = radarReports(await getJson(`${root}data/reports.json`));
    if (!reports.length) return setFailure(target, "暂无已验证日报。新的日报发布后会在这里按日期保存。");
    target.replaceChildren(...reports.map(summaryCard));
  };
  const contentSection = (heading, english, chinese) => {
    const section = element("section", undefined, "article-section");
    section.append(element("h3", heading === "What happened?" ? "发生了什么" : "为什么值得关注"));
    if (english) section.append(element("p", english, "content-en"));
    if (chinese) section.append(element("p", chinese, "content-zh"));
    return section;
  };
  const sectionLabels = { major_tech: "Major Tech · 重要科技", for_you: "For You · 与你相关", explore: "Explore · 探索", deep_read: "Deep Read · 深度阅读" };
  const storyRank = (left, right) => (Number(right.item.importance_score || 0) - Number(left.item.importance_score || 0))
    || (Number(left.item.source_tier || 9) - Number(right.item.source_tier || 9))
    || (Number(right.item.ranking_score || 0) - Number(left.item.ranking_score || 0))
    || String(right.item.published_at || "").localeCompare(String(left.item.published_at || ""));
  const isDeep = (item) => item.deep_read === true || [item.content_type, item.section, item.channel, item.supply_layer].includes("deep_read");
  const levelLabel = (item) => isDeep(item) ? "建议精读" : "只需知道";
  const storyFilters = (item) => [item.category, item.channel, item.section === "explore" ? "explore" : "", isDeep(item) ? "deep_read" : ""].filter(Boolean);
  const isResearch = (item) => {
    if (item.research === true || ["research", "paper"].includes(item.content_type)) return true;
    try {
      const { hostname, pathname } = new URL(item.original_url);
      const host = hostname.replace(/^www[.]/, "");
      if (["arxiv.org", "biorxiv.org", "medrxiv.org", "openreview.net", "doi.org"].includes(host)) return true;
      if (host === "nature.com" && pathname.startsWith("/articles/")) return true;
      if (host === "cas.cn" && pathname.startsWith("/syky/")) return true;
      return hostname === "news.mit.edu" && ["science", "robotics"].includes(item.category);
    } catch {
      return false;
    }
  };
  const storyTags = (item, topPick) => {
    const tags = [];
    if (topPick) tags.push("Top Pick");
    if (sectionLabels[item.section]) tags.push(sectionLabels[item.section]);
    if (item.catch_up) tags.push("Worth Catching Up · 值得补看");
    if (item.supply_layer && item.supply_layer !== "today") {
      const labels = {catch_up: "Worth Catching Up · 值得补看", deep_read: "Deep Read · 深度阅读", evergreen: "Evergreen · 长期价值"};
      tags.push(labels[item.supply_layer] || item.supply_layer);
    }
    return [...new Set(tags)];
  };
  const storyCard = (entry, report, topPick) => {
    const link = element("a", undefined, "story-card");
    link.href = reportHref(report.report_date, entry.key);
    link.dataset.filters = storyFilters(entry.item).join(" ");
    link.dataset.source = entry.item.source || "";
    link.dataset.level = isDeep(entry.item) ? "deep" : "brief";
    link.dataset.research = String(isResearch(entry.item));
    const heading = element("h3", entry.item.title_zh || entry.item.title_cn || entry.item.title_original, "story-title");
    const meta = element("p", `${entry.item.source} · ${formatPublished(entry.item.published_at)}`, "story-meta");
    const badges = element("div", undefined, "story-badges");
    badges.append(element("span", categoryLabels[entry.item.category] || entry.item.category || "科技", "category-badge"));
    if (channelLabels[entry.item.channel]) badges.append(element("span", channelLabels[entry.item.channel][1], "story-tag"));
    badges.append(element("span", levelLabel(entry.item), "story-tag reading-level"));
    storyTags(entry.item, topPick).forEach((tag) => badges.append(element("span", tag, "story-tag")));
    link.append(badges, heading, meta);
    return link;
  };
  const dashboardSection = (titleEn, titleZh, entries, report, topKeys) => {
    const section = element("section", undefined, "dashboard-section");
    const header = element("header", undefined, "dashboard-section-header");
    if (titleEn) header.append(element("p", titleEn, "eyebrow"));
    header.append(element("h2", titleZh));
    const grid = element("div", undefined, "story-grid");
    entries.forEach((entry) => grid.append(storyCard(entry, report, topKeys.has(entry.key))));
    section.append(header, grid);
    return section;
  };
  const optionOf = (value, label) => {
    const option = element("option", label);
    option.value = value;
    return option;
  };
  const selectField = (label, choices) => {
    const field = element("label", undefined, "reading-field");
    const select = element("select");
    field.append(element("span", label), select);
    select.append(...choices.map(([value, title]) => optionOf(value, title)));
    return { field, select };
  };
  const byLabel = (left, right) => left[1].localeCompare(right[1], "zh-CN");
  const sourceOptions = (entries) => [...new Set(entries.map(({ item }) => item.source).filter(Boolean))].map((source) => [source, source]).sort(byLabel);
  const levelOptions = [["", "全部分级"], ["deep", "建议精读"], ["brief", "只需知道"]];
  const categoryLabel = (value) => channelLabels[value]?.[1] || categoryLabels[value] || value;
  const renderDashboard = (target, report) => {
    const entries = reportRows(report);
    const supplyPriority = {today: 0, catch_up: 1, deep_read: 2, evergreen: 3};
    // Old archives without supply metadata preserve their existing ordering.
    const ranked = [...entries].sort((left, right) =>
      ((supplyPriority[left.item.supply_layer] ?? 0) - (supplyPriority[right.item.supply_layer] ?? 0)) || storyRank(left, right));
    const top = ranked.slice(0, Math.min(5, ranked.length));
    const topKeys = new Set(top.map((entry) => entry.key));
    const more = ranked.filter((entry) => !topKeys.has(entry.key));
    const filters = element("div", undefined, "story-filters");
    filters.setAttribute("aria-label", "资讯分类筛选");
    const values = [...new Set(entries.map((entry) => entry.item.channel).filter(Boolean)), ...new Set(entries.map((entry) => entry.item.category).filter(Boolean))].sort();
    if (entries.some((entry) => entry.item.section === "explore")) values.push("explore");
    if (entries.some((entry) => entry.item.section === "deep_read" || entry.item.content_type === "deep_read")) values.push("deep_read");
    const uniqueValues = [...new Set(values)];
    const labels = { explore: "探索", deep_read: "深度阅读", ...Object.fromEntries(Object.entries(channelLabels).map(([key, value]) => [key, value[1]])) };
    const controls = [["all", "全部"], ...uniqueValues.map((value) => [value, labels[value] || categoryLabels[value] || value])];
    controls.forEach(([value, label], index) => {
      const button = element("button", label, `filter-button${index === 0 ? " is-active" : ""}`);
      button.type = "button"; button.dataset.filter = value; button.setAttribute("aria-pressed", index === 0 ? "true" : "false");
      filters.append(button);
    });
    const topSection = dashboardSection("TOP PICKS", "今日重点", top, report, topKeys);
    const grouped = new Map();
    more.forEach((entry) => {
      const key = entry.item.content_type === "deep_read" || entry.item.channel === "deep_read" ? "deep_read" : entry.item.section === "explore" ? "explore" : entry.item.channel || "technology";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(entry);
    });
    const channels = [...new Set([...Object.keys(channelLabels), ...grouped.keys()])];
    const sections = channels.filter((key) => grouped.has(key)).map((key) => {
      const [english, chinese] = channelLabels[key] || ["", categoryLabel(key)];
      return dashboardSection(english, chinese, grouped.get(key), report, topKeys);
    });
    const source = selectField("来源", [["", "全部来源"], ...sourceOptions(entries)]);
    const level = selectField("阅读分级", levelOptions);
    const kind = selectField("内容", [["", "全部内容"], ["research", "研究更新"]]);
    const fields = element("div", undefined, "reading-toolbar");
    fields.append(source.field, level.field, kind.field);
    const count = element("p", "", "reading-count");
    count.setAttribute("role", "status");
    target.replaceChildren(filters, fields, count, topSection, ...sections);
    let theme = "all";
    const apply = () => {
      let visible = 0;
      target.querySelectorAll(".story-card").forEach((card) => {
        card.hidden = (theme !== "all" && !card.dataset.filters.split(" ").includes(theme))
          || (source.select.value && card.dataset.source !== source.select.value)
          || (level.select.value && card.dataset.level !== level.select.value)
          || (kind.select.value && card.dataset.research !== "true");
        if (!card.hidden) visible++;
      });
      target.querySelectorAll(".dashboard-section").forEach((section) => { section.hidden = !section.querySelector(".story-card:not([hidden])"); });
      count.textContent = visible ? "显示 " + visible + " 条资讯" : "没有符合筛选条件的资讯。";
    };
    fields.addEventListener("change", apply);
    filters.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-filter]");
      if (!button) return;
      theme = button.dataset.filter;
      filters.querySelectorAll("button").forEach((item) => { const active = item === button; item.classList.toggle("is-active", active); item.setAttribute("aria-pressed", active ? "true" : "false"); });
      apply();
    });
    apply();
  };
  const setReportHeader = (report) => {
    const name = report.category === "radar" || report.schema_version >= 3 ? "MarieSpace Radar" : report.schema_version >= 2 || report.category === "tech" ? "Tech Daily" : "AI Daily";
    document.title = `${name} · ${report.report_date}`;
    document.querySelector("#report-title").textContent = `${name} · ${report.report_date}`;
    document.querySelector("#report-meta").textContent = `${report.article_count} 条资讯 · 预计阅读 ${report.estimated_reading_minutes} 分钟 · ${formatDate(report.report_date)}`;
  };
  const sourceHeader = (item, titleEn, titleZh) => {
    const header = element("header", undefined, "article-header");
    if (item.category) header.append(element("span", categoryLabels[item.category] || "科技", "category-badge"));
    if (titleEn) header.append(element("h2", titleEn, "content-en"));
    if (titleZh && titleZh !== titleEn) header.append(element(titleEn ? "p" : "h2", titleZh, "article-title-cn content-zh"));
    header.append(element("span", levelLabel(item), "story-tag reading-level"));
    const published = new Date(item.published_at);
    const metadata = [
      item.source && "原始来源：" + item.source,
      Number.isFinite(+published) && "发布：" + published.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })
    ].filter(Boolean);
    const meta = element("p", metadata.join(" · "), "article-meta");
    const originalUrl = element("p", undefined, "original-url");
    originalUrl.append(element("strong", "原始链接："), element("span", item.original_url));
    const sourceLink = element("a", "查看原文 →", "source-link");
    if (metadata.length) header.append(meta);
    try {
      const parsedUrl = new URL(item.original_url);
      if (parsedUrl.protocol === "https:") {
        sourceLink.href = parsedUrl.href;
        sourceLink.target = "_blank";
        sourceLink.rel = "noopener noreferrer";
        header.append(originalUrl, sourceLink);
      }
    } catch { /* Historical favorites can still be read if their link is missing. */ }
    return header;
  };
  const renderArticle = (item, reference, allowSave = true) => {
    const article = element("article", undefined, "daily-article");
    if (sectionLabels[item.section]) article.append(element("p", sectionLabels[item.section], "eyebrow"));
    if (item.catch_up) article.append(element("p", "Worth Catching Up · 值得补看", "article-meta"));
    const titleEn = item.title_en || (item.original_language !== "zh" ? item.title_original : "");
    const titleZh = item.title_zh || item.title_cn || (item.original_language === "zh" ? item.title_original : "");
    article.append(sourceHeader(item, titleEn, titleZh));
    const happenedEn = item.what_happened_en || item.summary_en;
    const happenedZh = item.what_happened_zh || item.what_happened || item.summary_cn;
    const whyEn = item.why_it_matters_en || item.relevance;
    const whyZh = item.why_it_matters_zh || item.why_it_matters;
    if (happenedEn || happenedZh) article.append(contentSection("What happened?", happenedEn, happenedZh));
    if (whyEn || whyZh) article.append(contentSection("Why it matters?", whyEn, whyZh));
    const zh = article.querySelectorAll(".content-zh");
    const en = article.querySelectorAll(".content-en");
    zh.forEach((node) => { node.lang = "zh-CN"; });
    en.forEach((node) => { node.lang = "en"; });
    if (zh.length && en.length) {
      const language = selectField("阅读语言", [["both", "中英对照"], ["zh", "中文"], ["en", "English"]]);
      article.prepend(language.field);
      language.select.addEventListener("change", () => {
        zh.forEach((node) => { node.hidden = language.select.value === "en"; });
        en.forEach((node) => { node.hidden = language.select.value === "zh"; });
      });
    }
    if (allowSave) article.append(favoriteControls(item, reference));
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
    const report = await getReport(date);
    setReportHeader(report);
    const requestedArticle = params.get("article");
    if (requestedArticle) {
      const selected = reportRows(report).find((entry) => entry.key === requestedArticle);
      if (!selected) throw new Error("Unknown article");
      document.title = titleOf(selected.item) + " · MarieSpace Radar";
      const back = element("a", "← 返回当日日报", "back-link");
      back.href = reportHref(date);
      document.querySelector("#daily-report").replaceChildren(back, renderArticle(selected.item, selected));
    } else {
      renderDashboard(document.querySelector("#daily-report"), report);
    }
    const requestedFavorite = params.get("favorite");
    if (/^[a-f0-9]{64}$/.test(requestedFavorite || "")) {
      const matches = await Promise.all(reportRows(report).map(async (entry) => ({ ...entry, id: await articleId(entry.item) })));
      const reference = matches.find(({ id }) => id === requestedFavorite);
      if (reference) {
        const selected = reference.item;
        let status;
        try { status = favoriteMessage(await saveFavorite(selected, reference)); }
        catch { status = "收藏失败，请检查浏览器存储权限。"; }
        try {
          saveLocalFavorite(favoriteArticle(selected), reference);
          status += "\n已加入当前浏览器的「我的阅读」。";
        } catch { /* The existing Feishu action can succeed independently. */ }
        document.querySelector(".report-header").append(element("p", status, "favorite-status"));
        history.replaceState({}, "", reportHref(date));
      }
    }
  };
  const renderArchive = async () => {
    const target = document.querySelector("#archive-reports");
    const reports = radarReports(await getJson(root + "data/reports.json"));
    if (!reports.length) return setFailure(target, "暂无已验证的日报。");
    const view = selectField("浏览方式", [["editions", "按期查看"], ["articles", "筛选文章"], ["research", "研究更新"]]);
    const dates = selectField("归档日期", [["", "全部日期"], ...reports.map(({ report_date }) => [report_date, report_date])]);
    const topics = selectField("主题", [["", "全部主题"]]);
    const sources = selectField("来源", [["", "全部来源"]]);
    const levels = selectField("阅读分级", levelOptions);
    const toolbar = element("div", undefined, "reading-toolbar");
    const results = element("div", undefined, "report-list archive-results");
    const status = element("p", "", "reading-count");
    status.setAttribute("role", "status");
    toolbar.append(view.field, dates.field, topics.field, sources.field, levels.field);
    target.replaceChildren(toolbar, status, results);
    let version = 0;
    let entries = [];
    let failed = 0;
    let shown = 24;
    const setChoices = (select, choices) => {
      const value = select.value;
      select.replaceChildren(...choices.map(([key, label]) => optionOf(key, label)));
      if (choices.some(([key]) => key === value)) select.value = value;
    };
    const draw = () => {
      const matching = entries.filter(({ item }) =>
        (!topics.select.value || storyFilters(item).includes(topics.select.value)) &&
        (!sources.select.value || item.source === sources.select.value) &&
        (!levels.select.value || (isDeep(item) ? "deep" : "brief") === levels.select.value));
      status.textContent = "找到 " + matching.length + " 条" + (failed ? " · " + failed + " 期暂时无法读取" : "");
      results.replaceChildren();
      let grid;
      let previous;
      for (const entry of matching.slice(0, shown)) {
        if (entry.date !== previous) {
          const heading = element("h2", formatDate(entry.date), "archive-date");
          grid = element("div", undefined, "story-grid");
          results.append(heading, grid);
          previous = entry.date;
        }
        grid.append(storyCard(entry, { report_date: entry.date }, false));
      }
      if (!matching.length) results.append(element("p", "该范围内没有符合条件的条目。", "notice"));
      if (shown < matching.length) {
        const load = element("button", "再显示 24 条", "favorite-button");
        load.type = "button";
        load.addEventListener("click", () => {
          const next = shown;
          shown += 24;
          draw();
          results.querySelectorAll(".story-card")[next]?.focus();
        });
        results.append(load);
      }
    };
    const refresh = async () => {
      const request = ++version;
      const mode = view.select.value;
      const chosen = reports.filter(({ report_date }) => !dates.select.value || report_date === dates.select.value);
      const isEdition = mode === "editions";
      [topics, sources, levels].forEach(({ field, select }) => { field.hidden = isEdition; select.disabled = !isEdition; });
      if (isEdition) {
        status.textContent = chosen.length + " 期日报";
        results.replaceChildren(...chosen.map(summaryCard));
        return;
      }
      results.replaceChildren();
      status.textContent = "正在读取已发布的日报…";
      const data = await loadReports(chosen, () => request === version);
      if (request !== version) return;
      failed = data.unavailable;
      entries = data.loaded.flatMap(reportRows).filter(({ item }) => mode !== "research" || isResearch(item));
      const names = [...new Set(entries.flatMap(({ item }) => storyFilters(item)))];
      setChoices(topics.select, [["", "全部主题"], ...names.map((value) => [value, categoryLabel(value)]).sort(byLabel)]);
      setChoices(sources.select, [["", "全部来源"], ...sourceOptions(entries)]);
      [topics, sources, levels].forEach(({ select }) => { select.disabled = false; });
      shown = 24;
      draw();
    };
    if (new URLSearchParams(window.location.search).get("view") === "research") view.select.value = "research";
    for (const field of [view, dates]) field.select.addEventListener("change", refresh);
    for (const field of [topics, sources, levels]) field.select.addEventListener("change", () => { shown = 24; draw(); });
    await refresh();
  };
  const readingControls = (entry, onChange) => {
    const form = element("form", undefined, "reading-form");
    const status = selectField("阅读状态", Object.entries(readingLabels));
    status.select.value = readingStatus(entry);
    const label = element("label", undefined, "reading-field reading-note");
    const note = element("textarea");
    note.rows = 4;
    note.value = typeof entry.reading_note === "string" ? entry.reading_note : "";
    note.placeholder = "记录你的理解、问题或工程启发";
    note.maxLength = 12000;
    label.append(element("span", "个人收获"), note);
    const buttons = element("div", undefined, "favorite-controls");
    const save = element("button", "保存阅读记录", "favorite-button");
    save.type = "submit";
    const remove = element("button", "移出我的阅读", "favorite-button reading-secondary");
    remove.type = "button";
    const feedback = element("p", "", "favorite-status");
    feedback.setAttribute("role", "status");
    buttons.append(save, remove);
    form.append(status.field, label, buttons, feedback);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        if (!updateReading(localKey(entry), {
          reading_status: status.select.value, reading_note: note.value.trim()
        })) throw new Error("unknown_entry");
        feedback.textContent = "阅读记录已保存。";
        onChange(status.select.value, feedback.textContent);
      } catch {
        feedback.textContent = "保存失败，请确认条目仍在清单中，并检查浏览器存储权限。";
      }
    });
    form.addEventListener("keydown", (event) => {
      if (!event.isComposing && event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    remove.addEventListener("click", () => {
      if (!window.confirm("移出这篇文章？该浏览器中的阅读状态和个人收获也会删除。")) return;
      try {
        if (!updateReading(localKey(entry), null)) throw new Error("unknown_entry");
        onChange(null, "已移出我的阅读。");
      } catch {
        feedback.textContent = "无法移出条目，请检查浏览器存储权限。";
      }
    });
    return form;
  };
  const renderFavorites = () => {
    const target = document.querySelector("#favorite-list");
    const status = selectField("阅读状态", [["", "全部状态"], ...Object.entries(readingLabels)]);
    const count = element("p", "", "reading-count");
    count.setAttribute("role", "status");
    const feedback = element("p", "", "favorite-status");
    feedback.setAttribute("role", "status");
    const list = element("div", undefined, "reading-list");
    target.replaceChildren(status.field, count, feedback, list);
    function countItems() {
      const entries = localFavorites();
      const shown = entries.filter((entry) => !status.select.value || readingStatus(entry) === status.select.value).length;
      count.textContent = "显示 " + shown + " 条 · 共收藏 " + entries.length + " 条";
      list.querySelector(".notice")?.remove();
      if (!shown && !list.children.length) list.append(element("p", entries.length ? "该阅读状态下暂无条目。" : "从雷达资讯详情点「加入我的阅读」，文章就会出现在这里。", "notice"));
    }
    function draw() {
      list.replaceChildren();
      const entries = localFavorites().filter((entry) => !status.select.value || readingStatus(entry) === status.select.value);
      for (const entry of entries) {
        const details = element("details", undefined, "reading-entry");
        const summary = element("summary");
        const title = element("strong", titleOf(entry));
        const badge = element("span", readingLabels[readingStatus(entry)], "story-tag");
        summary.append(title, badge);
        const meta = element("p", [entry.source, entry.report_date, entry.saved_at?.slice(0, 10) && "收藏于 " + entry.saved_at.slice(0, 10)].filter(Boolean).join(" · "), "article-meta");
        const body = element("div", undefined, "reading-entry-body");
        details.append(summary, body);
        list.append(details);
        function onChange(value, text) {
          if (value === null || (status.select.value && status.select.value !== value)) {
            const next = details.nextElementSibling || details.previousElementSibling;
            details.remove();
            const nextSummary = next?.querySelector("summary");
            (nextSummary || status.select).focus();
            feedback.textContent = text;
          } else {
            badge.textContent = readingLabels[value];
          }
          countItems();
        }
        details.addEventListener("toggle", () => {
          if (!details.open || body.children.length) return;
          const preview = element("div");
          body.append(meta, preview, readingControls(entry, onChange));
          const showFallback = () => {
            const article = renderArticle(entry, null, false);
            if (entry.report_date) {
              article.prepend(element("p", "原日报暂时无法读取。仍可打开原始链接和编辑阅读记录。", "notice"));
            }
            preview.replaceChildren(article);
          };
          if (!entry.report_date || !entry.article_key) {
            showFallback();
            return;
          }
          const link = element("a", "回到雷达条目 →", "source-link");
          link.href = reportHref(entry.report_date, entry.article_key);
          const loading = element("p", "正在读取原日报…", "notice");
          preview.replaceChildren(loading);
          getReport(entry.report_date).then((report) => {
            const rows = reportRows(report);
            const found = rows.find(({ item, key }) => key === entry.article_key && localKey(item) === localKey(entry))
              || rows.find(({ item }) => localKey(item) === localKey(entry));
            if (!found) { showFallback(); return; }
            link.href = reportHref(found.date, found.key);
            preview.replaceChildren(link, renderArticle(found.item, found, false));
          }).catch(showFallback);
        });
      }
      countItems();
    }
    status.select.addEventListener("change", draw);
    draw();
  };

  const run = async () => {
    try {
      if (page === "home") await renderHome();
      if (page === "channel") await renderReportList(document.querySelector("#channel-reports"));
      if (page === "archive") await renderArchive();
      if (page === "daily") await renderDaily();
      if (page === "favorites") renderFavorites();
    } catch {
      const target = document.querySelector("#daily-report, #channel-reports, #archive-reports, #favorite-list, #today-notice");
      if (target) setFailure(target, "日报暂时无法载入，请稍后重试。");
    }
  };
  run();
})();
