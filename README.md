# AI Daily 飞书资讯中心 H5

这是已接入飞书工作台的 AI Daily H5。它继续使用原有 GitHub Pages 地址，并由飞书网页应用作为 PC、手机与平板的统一入口。

## Phase 5 功能

- 首页展示最近一份已发布的 AI Daily：日期、资讯数量、预计阅读时间和今日重点。
- AI 频道和历史归档从 `data/reports.json` 读取日期列表。
- 日报详情使用 `daily/ai/?date=YYYY-MM-DD` 打开，并从 `data/daily/ai/YYYY-MM-DD.json` 读取内容。
- 每条资讯分别显示中文标题、原文标题、来源、发布时间、Original Key Points、中文翻译、AI 总结、English Summary、相关性和 Useful Expressions。
- “查看原文”直接打开已验证的 `original_url`，不会跳转到本站替代地址。

## 本地验证

```powershell
py -3 -m unittest discover -s tests -v
py -3 -m http.server 8000
```

打开：

- `http://localhost:8000/`
- `http://localhost:8000/ai/`
- `http://localhost:8000/archive/`
- `http://localhost:8000/daily/ai/?date=2026-09-14`

部署地址保持为 [AI Daily](https://marie-bro.github.io/ai-daily-public-site/)。每次有新的已验证日报时，在数据流水线项目执行 `py -3 run_publish.py`，提交两个项目的改动即可更新飞书内的页面。

## 阶段边界

本项目不保存密钥、不调用 DeepSeek、不抓取新闻、不发送飞书通知。Phase 6 的机器人每日通知尚未开始。
