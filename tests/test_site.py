import unittest
import json
from urllib.parse import urlparse
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGES = (ROOT / "index.html", ROOT / "ai" / "index.html", ROOT / "archive" / "index.html", ROOT / "daily" / "ai" / "index.html")


class PublicSiteTests(unittest.TestCase):
    def test_bilingual_content_renderer_and_secondary_chinese_style(self):
        home = (ROOT / "index.html").read_text(encoding="utf-8-sig")
        script = (ROOT / "assets" / "site.js").read_text(encoding="utf-8-sig")
        self.assertIn("Tech Daily", home)
        self.assertIn("\u79d1\u6280\u9891\u9053", home)
        self.assertNotIn("Home /", home)
        self.assertIn('contentSection("What happened?"', script)
        self.assertIn('contentSection("Why it matters?"', script)
        self.assertIn("content-en", script)
        self.assertIn("content-zh", script)
        self.assertNotIn("key_points_original", script)
        self.assertNotIn("Read Original", script)
        self.assertNotIn("Source /", script)
        self.assertLess(script.index("titleEn"), script.index("titleZh"))
        self.assertLess(script.index("happenedEn"), script.index("happenedZh"))
        self.assertLess(script.index("whyEn"), script.index("whyZh"))
        styles = (ROOT / "assets" / "styles.css").read_text(encoding="utf-8")
        self.assertIn(".report-header h1", styles)
        self.assertIn("overflow-wrap:anywhere", styles)
        self.assertIn(".content-en { color:var(--ink); }", styles)
        self.assertIn(".content-zh { color:var(--muted); font-size:.92em", styles)
        self.assertIn(".article-section .content-zh { margin:12px 0 25px; }", styles)

    def test_current_daily_keeps_bilingual_content_and_original_source_metadata(self):
        report = json.loads((ROOT / "data" / "daily" / "ai" / "2026-09-20.json").read_text(encoding="utf-8"))
        self.assertEqual(report["schema_version"], 3)
        for item in report["items"]:
            for field in ("title_en", "title_cn", "what_happened_en", "what_happened", "why_it_matters_en", "why_it_matters"):
                self.assertTrue(item[field], field)
            self.assertTrue(item["source"])
            self.assertTrue(item["published_at"])
            self.assertEqual(urlparse(item["original_url"]).scheme, "https")

    def test_required_routes_exist(self):
        for page in PAGES:
            self.assertTrue(page.is_file(), page)

    def test_shared_style_and_mobile_viewport(self):
        for page in PAGES:
            content = page.read_text(encoding="utf-8")
            self.assertNotIn('href="/assets/styles.css"', content)
            self.assertIn('width=device-width, initial-scale=1', content)
        styles = (ROOT / "assets" / "styles.css").read_text(encoding="utf-8")
        self.assertIn("@media (max-width:640px)", styles)
        self.assertIn(".report-page,.report-header,.daily-article,.article-section,.report-link { min-width:0; max-width:100%; }", styles)
        self.assertIn("overflow-wrap:anywhere", styles)

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
