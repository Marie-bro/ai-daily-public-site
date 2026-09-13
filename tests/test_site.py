import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1] / "site"
PAGES = (ROOT / "index.html", ROOT / "ai" / "index.html", ROOT / "archive" / "index.html")


class PublicSiteTests(unittest.TestCase):
    def test_required_routes_exist(self):
        for page in PAGES:
            self.assertTrue(page.is_file(), page)

    def test_shared_style_and_mobile_viewport(self):
        for page in PAGES:
            content = page.read_text(encoding="utf-8")
            self.assertIn('href="/assets/styles.css"', content)
            self.assertIn('width=device-width, initial-scale=1', content)

    def test_home_navigation_covers_required_routes(self):
        home = PAGES[0].read_text(encoding="utf-8")
        for route in ('href="/"', 'href="/ai/"', 'href="/archive/"'):
            self.assertIn(route, home)

    def test_site_does_not_contain_secrets_or_fake_source_links(self):
        content = "\n".join(page.read_text(encoding="utf-8") for page in PAGES)
        self.assertNotIn("DEEPSEEK_API_KEY", content)
        self.assertNotIn("FEISHU_APP_SECRET", content)
        self.assertNotIn("查看原文", content)
