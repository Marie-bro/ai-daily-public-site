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
  const latestAiReport = (index) => (index.reports || []).find((report) => report.category === "ai");
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
    const report = latestAiReport(index);
    if (!report) throw new Error("No AI report");
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
    const reports = (index.reports || []).filter((report) => report.category === "ai");
    if (!reports.length) throw new Error("No reports");
    target.replaceChildren(...reports.map(summaryCard));
  };
  const labelledList = (title, values) => {
    const section = element("section", undefined, "article-section");
    section.append(element("h3", title));
    const list = element("ul");
    values.forEach((value) => list.append(element("li", value)));
    section.append(list);
    return section;
  };
  const renderArticle = (item) => {
    const article = element("article", undefined, "daily-article");
    const header = element("header", undefined, "article-header");
    header.append(element("p", item.title_cn, "article-title-cn"), element("h2", item.title_original));
    const meta = element("p", `${item.source} · ${new Date(item.published_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}`, "article-meta");
    const sourceLink = element("a", "查看原文 →", "source-link");
    sourceLink.href = item.original_url;
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    header.append(meta, sourceLink);
    article.append(header, labelledList("Original Key Points", item.key_points_original), labelledList("中文翻译", item.translation));
    const summaries = element("section", undefined, "article-section");
    summaries.append(element("h3", "AI 总结"), element("p", item.summary_cn), element("h3", "English Summary"), element("p", item.summary_en), element("h3", "与你相关"), element("p", item.relevance));
    article.append(summaries);
    if ((item.useful_expressions || []).length) article.append(labelledList("Useful Expressions", item.useful_expressions));
    return article;
  };
  const renderDaily = async () => {
    const params = new URLSearchParams(window.location.search);
    let date = params.get("date");
    if (!date) {
      const index = await getJson(`${root}data/reports.json`);
      date = latestAiReport(index)?.report_date;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw new Error("Invalid report date");
    const report = await getJson(`${root}data/daily/ai/${date}.json`);
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
