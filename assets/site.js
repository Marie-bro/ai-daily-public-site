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
    ai: "AI / 人工智能", chips: "Chips / 芯片", consumer_tech: "Consumer Tech / 消费科技", software: "Software / 软件",
    robotics: "Robotics / 机器人", mobility: "Mobility / 智能出行", space: "Space / 航天", science: "Science / 科学",
    internet: "Internet / 互联网", other_tech: "Other Tech / 其他科技"
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
  const summaryCard = (report) => {
    const link = element("a", undefined, "report-link");
    link.href = reportHref(report.report_date);
    const title = element("h2", `${report.schema_version >= 2 || report.category === "tech" ? "Tech Daily" : "AI Daily"} · ${report.report_date}`);
    const facts = element("p", `${report.article_count} 条资讯 · 预计阅读 ${report.estimated_reading_minutes} 分钟`, "report-facts");
    const highlights = element("p", (report.highlights || []).join(" · "), "report-highlights");
    link.append(title, facts, highlights, element("span", "阅读日报 →", "text-link"));
    return link;
  };
  const renderHome = async () => {
    const index = await getJson(`${root}data/reports.json`);
    const latest = latestReport(index);
    const report = techReports(index).find((entry) => entry.report_date === todayInShanghai());
    if (!report) {
      document.querySelector("#today-title").textContent = "No qualified technology news today / 今日暂无符合条件的科技资讯";
      document.querySelector("#today-date").textContent = formatDate(todayInShanghai());
      document.querySelector("#article-count").textContent = "0 条";
      document.querySelector("#reading-minutes").textContent = "—";
      document.querySelector("#today-highlight").textContent = "None / 暂无";
      document.querySelector("#today-notice").textContent = latest ? `Latest issue: ${latest.report_date}. 历史归档仍可回看。` : "No empty report is generated when no item qualifies. 没有合格资讯时不会生成空日报。";
      document.querySelector("#today-link").href = latest ? reportHref(latest.report_date) : `${root}ai/`;
      document.querySelector("#today-link").firstChild.textContent = latest ? "Read latest / 阅读最近一期 " : "Browse Tech / 浏览科技频道 ";
      return;
    }
    document.querySelector("#today-title").textContent = `Tech Daily · ${report.report_date}`;
    document.querySelector("#today-date").textContent = formatDate(report.report_date);
    document.querySelector("#article-count").textContent = `${report.article_count} 条`;
    document.querySelector("#reading-minutes").textContent = `${report.estimated_reading_minutes} 分钟`;
    document.querySelector("#today-highlight").textContent = (report.highlights || ["已发布"])[0];
    document.querySelector("#today-notice").textContent = "Collected broadly and selected strictly; every item retains a traceable original source. 广泛采集、严格筛选；每条资讯均保留可追溯原文。";
    document.querySelector("#today-link").href = reportHref(report.report_date);
    document.querySelector("#archive-preview-title").textContent = `最近日报：${report.report_date}`;
    document.querySelector("#archive-preview-copy").textContent = `${report.article_count} 条已验证科技资讯，预计阅读 ${report.estimated_reading_minutes} 分钟。`;
  };
  const renderReportList = async (target) => {
    const reports = techReports(await getJson(`${root}data/reports.json`));
    if (!reports.length) return setFailure(target, "No verified daily report is available yet. 新日报发布后会在这里按日期保存。");
    target.replaceChildren(...reports.map(summaryCard));
  };
  const bilingualSection = (headingEn, textEn, headingZh, textZh) => {
    const section = element("section", undefined, "article-section");
    section.append(element("h3", headingEn), element("p", textEn, "article-copy-en"),
      element("h3", headingZh), element("p", textZh, "article-copy-zh"));
    return section;
  };
  const sourceHeader = (item, titleEn, titleZh) => {
    const header = element("header", undefined, "article-header");
    if (item.category) header.append(element("span", categoryLabels[item.category] || "科技", "category-badge"));
    header.append(element("h3", "Title"), element("h2", titleEn), element("h3", "标题"), element("p", titleZh, "article-title-cn"));
    const meta = element("p", `Source / 来源：${item.source} · Published at / 发布时间：${new Date(item.published_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}`, "article-meta");
    const originalUrl = element("p", undefined, "original-url");
    originalUrl.append(element("strong", "Original URL / 原始链接："), element("span", item.original_url));
    const sourceLink = element("a", "Read Original / 查看原文 →", "source-link");
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
    const isBilingual = schemaVersion >= 3 && item.title_en && item.what_happened_en && item.why_it_matters_en;
    const titleEn = isBilingual ? item.title_en : item.title_original;
    const titleZh = item.title_cn;
    article.append(sourceHeader(item, titleEn, titleZh));
    const happenedEn = isBilingual ? item.what_happened_en : item.summary_en;
    const happenedZh = isBilingual ? item.what_happened : item.summary_cn;
    if (happenedEn && happenedZh) article.append(bilingualSection("What happened?", happenedEn, "发生了什么？", happenedZh));
    if (isBilingual) article.append(bilingualSection("Why it matters?", item.why_it_matters_en, "为什么值得关注？", item.why_it_matters));
    return article;
  };
  const renderDaily = async () => {
    const params = new URLSearchParams(window.location.search);
    let date = params.get("date");
    if (!date) date = latestReport(await getJson(`${root}data/reports.json`))?.report_date;
    if (!date) {
      document.querySelector("#report-title").textContent = "No qualified technology news today / 今日暂无符合条件的科技资讯";
      document.querySelector("#daily-report").replaceChildren(element("p", "No empty report is generated when no item qualifies. 历史日报仍可按日期回看。", "notice"));
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
  };
  const run = async () => {
    try {
      if (page === "home") await renderHome();
      if (page === "channel") await renderReportList(document.querySelector("#channel-reports"));
      if (page === "archive") await renderReportList(document.querySelector("#archive-reports"));
      if (page === "daily") await renderDaily();
    } catch {
      const target = document.querySelector("#daily-report, #channel-reports, #archive-reports, #today-notice");
      if (target) setFailure(target, "The daily report is temporarily unavailable. 日报暂时无法载入，请稍后重试。");
    }
  };
  run();
})();
