# AI Daily 公开网站

这是与现有飞书机器人分离的独立 Phase 2 项目。它只提供公开、无需登录、适配手机/平板/电脑的资讯网站基础框架；当前没有新闻采集、AI 摘要、飞书推送或 DeepSeek 调用。

Phase 2 已部署至 [公开网站](https://marie-bro.github.io/ai-daily-public-site/)。下一阶段必须等用户验收后才会开始。

## 路由

- `/` 首页
- `/ai/` AI 频道
- `/archive/` 历史归档

网站现在会明确显示“第一期日报尚未发布”，不会以示例内容伪装成真实新闻。

## 本地检查

```powershell
py -3 -m unittest discover -s tests -v
py -3 -m http.server 8000
```

打开 `http://localhost:8000`、`/ai/`、`/archive/`。按 `Ctrl+C` 停止本地预览。

## 部署

部署步骤见 [GitHub Pages](deploy/github-pages.md)。部署目标是你账号下的新项目 `ai-daily-public-site`，与现有飞书项目完全分离。

## 阶段规则

本项目一次只完成一个 Phase。Phase 2 已完成并等待验收；验收前不开始 Phase 3。
