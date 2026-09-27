# MarieSpace Radar 飞书资讯中心 H5

MarieSpace Radar 是飞书工作台中的每日高价值信息入口。正式地址为 `https://news.mariespace.cn/`，通过腾讯云 EdgeOne Makers 部署；页面本身不依赖任何代码托管站点域名。

## 内容规则

- 只显示来自允许公开域名并且已验证的资讯。
- 不显示与受限来源相关的日报、链接、标题、摘要或历史记录。
- 每条正式资讯都保留真实的外部原文入口。
- 没有满足规则的日报时，页面会明确显示“暂无已验证日报”，不会补造内容。

## 页面路由

- `/`：今日 Radar 看板（Top Picks 与有内容的频道）
- `/ai/`：每日 Radar 列表
- `/archive/`：按日期历史归档
- `/daily/ai/?date=YYYY-MM-DD`：指定日期看板
- `/daily/ai/?date=YYYY-MM-DD&article=ARTICLE_ID`：中英双语资讯详情

## 本地验证

```powershell
py -3 -m unittest discover -s tests -v
py -3 -m http.server 8000
```

飞书网页应用的桌面端和移动端主页均使用 `https://news.mariespace.cn/`。页面不保存密钥、不调用模型、不抓取资讯，也不发送机器人通知。
