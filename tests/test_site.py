import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGES = (ROOT / "index.html", ROOT / "ai" / "index.html", ROOT / "archive" / "index.html", ROOT / "daily" / "ai" / "index.html")


class PublicSiteTests(unittest.TestCase):
    def test_phase5_5_tech_daily_copy_and_dual_schema_renderer(self):
        home = (ROOT / "index.html").read_text(encoding="utf-8-sig")
        script = (ROOT / "assets" / "site.js").read_text(encoding="utf-8-sig")
        self.assertIn("Tech Daily", home)
        self.assertIn("科技频道", home)
        self.assertIn("今日暂无符合条件的科技资讯", script)
        self.assertIn("发生了什么", script)
        self.assertIn("为什么值得关注", script)
        self.assertIn("schemaVersion >= 2", script)
        self.assertIn("key_points_original", script)  # legacy report compatibility

    def test_required_routes_exist(self):
        for page in PAGES:
            self.assertTrue(page.is_file(), page)

    def test_shared_style_and_mobile_viewport(self):
        for page in PAGES:
            content = page.read_text(encoding="utf-8")
            self.assertNotIn('href="/assets/styles.css"', content)
            self.assertIn('width=device-width, initial-scale=1', content)

    def test_home_navigation_covers_required_routes(self):
        home = PAGES[0].read_text(encoding="utf-8")
        for route in ('href="./"', 'href="ai/"', 'href="archive/"'):
            self.assertIn(route, home)

    def test_site_contains_a_date_addressable_daily_route_and_public_domain_only_data(self):
        daily = ROOT / "daily" / "ai" / "index.html"
        self.assertIn('data-page="daily"', daily.read_text(encoding="utf-8"))
        index = (ROOT / "data" / "reports.json").read_text(encoding="utf-8")
        self.assertNotIn("github.com", index.lower())
        self.assertNotIn("openai.com", index.lower())

    def test_pages_do_not_use_root_absolute_links(self):
        for page in PAGES:
            self.assertNotRegex(page.read_text(encoding="utf-8"), r'href="/(?!daily/)')

    def test_site_does_not_contain_secrets_or_fake_source_links(self):
        content = "\n".join(page.read_text(encoding="utf-8") for page in PAGES)
        self.assertNotIn("DEEPSEEK_API_KEY", content)
        self.assertNotIn("FEISHU_APP_SECRET", content)
        self.assertNotIn("查看原文", content)
