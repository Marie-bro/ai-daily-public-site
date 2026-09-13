# GitHub Pages 部署

该项目通过 GitHub Pages 直接部署 `main` 分支根目录。网站是纯静态文件，不包含也不需要 API Key、App Secret 或 `.env`。

【在哪里操作】GitHub 仓库 → Settings → Pages。

【具体操作】

1. 打开 `Marie-bro/ai-daily-public-site` 的 **Settings** → **Pages**，在 **Build and deployment** 中将 Source 设为 **Deploy from a branch**。
2. 在 Branch 中选择 `main` 与 `/(root)`，保存。页面显示的地址通常是 `https://marie-bro.github.io/ai-daily-public-site/`。
3. 用手机、平板和电脑分别打开首页、`/ai/` 与 `/archive/`，并确认关闭本地电脑后仍可访问。

【目标】获得公开、无需登录、HTTPS 的网站地址。

【正常现象】页面显示“正在准备第一期日报”，没有任何伪造新闻。

【异常现象】若 Pages 尚未启用，确认已选择 `main` 与 `/(root)` 并保存；不要上传或提交 `.env`、日志、状态文件及现有飞书项目。

【停止条件】若中国大陆网络下有设备无法稳定访问，停止把该 Pages 地址作为正式站点，记录测试结果后在 Phase 2 内改用国内静态托管平台。
