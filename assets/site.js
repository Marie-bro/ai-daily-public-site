(() => {
  const date = document.querySelector("#today-date");
  if (!date) return;
  const now = new Date();
  date.dateTime = now.toISOString().slice(0, 10);
  date.textContent = new Intl.DateTimeFormat("zh-CN", { timeZone:"Asia/Shanghai", year:"numeric", month:"long", day:"numeric", weekday:"short" }).format(now);
})();
