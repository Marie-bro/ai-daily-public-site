(() => {
  const root = document.documentElement.dataset.root || "./";
  const page = document.documentElement.dataset.page;
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const reportHref = (date) => `${root}daily/ai/?date=${encodeURIComponent(date)}`;
  const formatDate = (date) => new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date(`${date}T12:00:00+08:00`));
  const getJson = async (path) => {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };
  const aiReports = (index) => Array.isArray(index.reports)
    ? index.reports.filter((report) => report.category === "ai" && report.article_count > 0 && /^\d{4}-\d{2}-\d{2}$/.test(report.report_date)).sort((a, b) => b.report_date.localeCompare(a.report_date))
    : [];
  const latestAiReport = (index) => aiReports(index)[0];
  const todayInShanghai = () => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const value = (type) => parts.find((part) => part.type === type).value;
    return `${value("year")}-${value("month")}-${value("day")}`;
  };
  const setFailure = (target, text) => { target.replaceChildren(element("p", text, "notice")); };
  const summaryCard = (report) => {
    const link = element("a", undefined, "report-link");
    link.href = reportHref(report.report_date);
    const title = element("h2", `AI Daily · ${report.report_date}`);
    const facts = element("p", `${report.article_count} 条资讯 · 预计阅读 ${report.estimated_reading_minutes} 分钟`, "report-facts");
    const highlights = element("p", (report.highlights || []).join(" · "), "report-highlights");
    link.append(title, facts, highlights, element("span", "阅读日报 →", "text-link"));
    return link;
  };
  const renderHome = async () => {
    const index = await getJson(`${root}data/reports.json`);
    const latest = latestAiReport(index);
    const report = aiReports(index).find((entry) => entry.report_date === todayInShanghai());
    if (!report) {
      document.querySelector("#today-title").textContent = "今日暂无符合条件的资讯";
      document.querySelector("#today-date").textContent = formatDate(todayInShanghai());
      document.querySelector("#article-count").textContent = "0 条";
      document.querySelector("#reading-minutes").textContent = "—";
      document.querySelector("#today-highlight").textContent = "暂无";
      document.querySelector("#today-notice").textContent = latest
        ? `最新一期为 ${latest.report_date}，仍可从历史归档回看。`
        : "没有合格资讯时不会生成空日报。";
      document.querySelector("#today-link").href = latest ? reportHref(latest.report_date) : `${root}ai/`;
      document.querySelector("#today-link").firstChild.textContent = latest ? "阅读最近一期 " : "浏览 AI 频道 ";
      if (latest) {
        document.querySelector("#archive-preview-title").textContent = `最近日报：${latest.report_date}`;
        document.querySelector("#archive-preview-copy").textContent = `${latest.article_count} 条已验证 AI 资讯，预计阅读 ${latest.estimated_reading_minutes} 分钟。`;
      }
      return;
    }
    document.querySelector("#today-title").textContent = `AI Daily · ${report.report_date}`;
    document.querySelector("#today-date").textContent = formatDate(report.report_date);
    document.querySelector("#article-count").textContent = `${report.article_count} 条`;
    document.querySelector("#reading-minutes").textContent = `${report.estimated_reading_minutes} 分钟`;
    document.querySelector("#today-highlight").textContent = (report.highlights || ["已发布"])[0];
    document.querySelector("#today-notice").textContent = "内容均来自已验证来源；原文入口位于日报详情。";
    document.querySelector("#today-link").href = reportHref(report.report_date);
    document.querySelector("#archive-preview-title").textContent = `最近日报：${report.report_date}`;
    document.querySelector("#archive-preview-copy").textContent = `${report.article_count} 条已验证 AI 资讯，预计阅读 ${report.estimated_reading_minutes} 分钟。`;
  };
  const renderReportList = async (target) => {
    const index = await getJson(`${root}data/reports.json`);
    const reports = aiReports(index);
    if (!reports.length) {
      setFailure(target, "暂无已验证日报。新的日报发布后会在这里按日期保存。");
      return;
    }
    target.replaceChildren(...reports.map(summaryCard));
  };
  const labelledList = (title, values) => {
    const section = element("section", undefined, "article-section");
    section.append(element("h3", title));
    const list = element("ul");
    (Array.isArray(values) ? values : []).forEach((value) => list.append(element("li", value)));
    section.append(list);
    return section;
  };
  const renderArticle = (item) => {
    const article = element("article", undefined, "daily-article");
    const header = element("header", undefined, "article-header");
    header.append(element("p", item.title_cn, "article-title-cn"), element("h2", item.title_original));
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
    const isChineseOriginal = item.original_language === "zh";
    article.append(header, labelledList(isChineseOriginal ? "原文要点" : "Original Key Points", item.key_points_original),
      labelledList(isChineseOriginal ? "English Translation" : "中文翻译", item.translation));
    const summaries = element("section", undefined, "article-section");
    summaries.append(element("h3", "AI 总结"), element("p", item.summary_cn), element("h3", "English Summary"), element("p", item.summary_en), element("h3", "与你相关"), element("p", item.relevance));
    article.append(summaries);
    if (Array.isArray(item.useful_expressions) && item.useful_expressions.length) article.append(labelledList("Useful Expressions", item.useful_expressions));
    return article;
  };
  const renderDaily = async () => {
    const params = new URLSearchParams(window.location.search);
    let date = params.get("date");
    if (!date) {
      const index = await getJson(`${root}data/reports.json`);
      date = latestAiReport(index)?.report_date;
    }
    if (!date) {
      document.querySelector("#report-title").textContent = "今日暂无符合条件的资讯";
      document.querySelector("#daily-report").replaceChildren(element("p", "没有合格资讯时不会生成空日报；历史日报发布后可按日期回看。", "notice"));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid report date");
    const report = await getJson(`${root}data/daily/ai/${date}.json`);
    if (report.report_date !== date || !Array.isArray(report.items) || !report.items.length) throw new Error("Invalid report data");
    document.title = `AI Daily · ${report.report_date}`;
    document.querySelector("#report-title").textContent = `AI Daily · ${report.report_date}`;
    document.querySelector("#report-meta").textContent = `${report.article_count} 条资讯 · 预计阅读 ${report.estimated_reading_minutes} 分钟 · ${formatDate(report.report_date)}`;
    document.querySelector("#daily-report").replaceChildren(...report.items.map(renderArticle));
  };
  const run = async () => {
    try {
      if (page === "home") await renderHome();
      if (page === "channel") await renderReportList(document.querySelector("#channel-reports"));
      if (page === "archive") await renderReportList(document.querySelector("#archive-reports"));
      if (page === "daily") await renderDaily();
    } catch (error) {
      const target = document.querySelector("#daily-report, #channel-reports, #archive-reports, #today-notice");
      if (target) setFailure(target, "日报暂时无法载入，请稍后重试。");
    }
  };
  run();
})();
