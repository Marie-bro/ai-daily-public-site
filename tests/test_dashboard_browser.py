import json
import re
import subprocess
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
EDGE_CANDIDATES = (
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
)
EDGE = next((path for path in EDGE_CANDIDATES if path.is_file()), None)
DATE = "2026-09-27"
PROBE = """<script>
const probe = window.setInterval(() => {
  const cards = document.querySelectorAll('.story-card');
  if (!cards.length && !document.querySelector('.daily-article')) return;
  window.clearInterval(probe);
  const top = document.querySelectorAll('.dashboard-section:first-of-type .story-card').length;
  const all = document.querySelectorAll('.dashboard-section:nth-of-type(2) .story-card').length;
  document.body.dataset.cardCount = String(cards.length);
  document.body.dataset.topCount = String(top);
  document.body.dataset.allCount = String(all);
  document.body.dataset.overflow = String(document.documentElement.scrollWidth > document.documentElement.clientWidth);
  document.body.dataset.englishCard = String([...document.querySelectorAll('.story-title')].some(node => node.textContent.includes('English title')));
  document.body.dataset.filters = [...document.querySelectorAll('.filter-button')].map(node => node.dataset.filter).join(',');
  const explore = document.querySelector('.filter-button[data-filter="explore"]');
  if (explore) explore.click();
  document.body.dataset.exploreVisible = String([...cards].filter(node => !node.hidden).length);
  document.querySelector('.filter-button[data-filter="all"]')?.click();
  document.body.dataset.detailEnglish = String(document.querySelectorAll('.daily-article .content-en').length);
  document.body.dataset.detailChinese = String(document.querySelectorAll('.daily-article .content-zh').length);
  const firstEnglish = document.querySelector('.daily-article .content-en');
  const firstChinese = document.querySelector('.daily-article .content-zh');
  document.body.dataset.detailOrder = String(!firstEnglish || !firstChinese || Boolean(firstEnglish.compareDocumentPosition(firstChinese) & Node.DOCUMENT_POSITION_FOLLOWING));
  document.body.dataset.originalLink = String(Boolean(document.querySelector('.daily-article .source-link[href^="https://"]')));
  document.body.dataset.favorite = String(Boolean(document.querySelector('.daily-article .favorite-button')));
}, 25);
</script>"""


def report(count):
    categories = ("ai", "robotics", "chips", "science", "space", "software", "consumer_tech")
    items = []
    for index in range(count):
        category = categories[index % len(categories)]
        section = "deep_read" if index in (6, 13) else "explore" if index % 4 == 0 else "major_tech" if index < 5 else "for_you"
        items.append({
            "article_id": f"{index + 1:064x}", "title_cn": f"中文科技标题 {index + 1}",
            "title_en": f"English title {index + 1}", "title_original": f"Original title {index + 1}",
            "source": f"Source {index % 5 + 1}", "published_at": f"2026-09-27T{index % 20:02d}:00:00+00:00",
            "original_url": f"https://example.com/story-{index + 1}", "category": category,
            "original_language": "en", "what_happened": f"发生了什么 {index + 1}",
            "what_happened_en": f"What happened {index + 1}", "why_it_matters": f"为什么值得关注 {index + 1}",
            "why_it_matters_en": f"Why it matters {index + 1}", "importance_score": 95 - index,
            "ranking_score": 90 - index, "source_tier": index % 3 + 1, "section": section,
            "content_type": "deep_read" if section == "deep_read" else "news", "catch_up": index % 6 == 0,
        })
    return {"schema_version": 3, "category": "tech", "report_date": DATE,
            "article_count": count, "estimated_reading_minutes": 8, "items": items}


class FixtureHandler(BaseHTTPRequestHandler):
    story_count = 14

    def log_message(self, *_):
        pass

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/data/reports.json":
            payload = {"reports": [{"category": "tech", "report_date": DATE, "article_count": self.story_count,
                                     "estimated_reading_minutes": 8}]}
            return self.send_json(payload)
        if path == f"/data/daily/ai/{DATE}.json":
            return self.send_json(report(self.story_count))
        relative = "index.html" if path == "/" else path.lstrip("/") + ("index.html" if path.endswith("/") else "")
        target = (ROOT / relative).resolve()
        if ROOT not in target.parents and target != ROOT:
            self.send_error(404)
            return
        if not target.is_file():
            self.send_error(404)
            return
        body = target.read_bytes()
        if target.suffix == ".html":
            body = target.read_text(encoding="utf-8").replace("</body>", PROBE + "</body>").encode("utf-8")
        content_type = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8"}.get(target.suffix, "application/octet-stream")
        self.send_response(200); self.send_header("Content-Type", content_type); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)

    def send_json(self, value):
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(200); self.send_header("Content-Type", "application/json; charset=utf-8"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)


@unittest.skipUnless(EDGE, "Microsoft Edge is required for the responsive browser check")
class DashboardBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), FixtureHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close(); cls.thread.join(timeout=2)

    def dump(self, path, width, count):
        FixtureHandler.story_count = count
        with tempfile.TemporaryDirectory() as profile:
            result = subprocess.run([
                str(EDGE), "--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
                f"--user-data-dir={profile}", f"--window-size={width},1200", "--virtual-time-budget=2500",
                "--dump-dom", f"{self.base}{path}",
            ], capture_output=True, timeout=25)
        self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", errors="replace"))
        return result.stdout.decode("utf-8", errors="replace")

    def attribute(self, html, name):
        match = re.search(fr'data-{name}="([^"]+)"', html)
        self.assertIsNotNone(match, f"missing browser probe {name}")
        return match.group(1)

    def test_dashboard_counts_and_responsive_widths(self):
        for count in (10, 14, 18):
            for width in (390, 800, 1280):
                with self.subTest(count=count, width=width):
                    html = self.dump("/", width, count)
                    self.assertEqual(self.attribute(html, "card-count"), str(count))
                    self.assertEqual(self.attribute(html, "top-count"), "5")
                    self.assertEqual(self.attribute(html, "all-count"), str(count - 5))
                    self.assertEqual(self.attribute(html, "overflow"), "false")
                    self.assertEqual(self.attribute(html, "english-card"), "false")
                    filters = self.attribute(html, "filters").split(",")
                    for expected in ("all", "ai", "robotics", "chips", "science", "explore", "deep_read"):
                        self.assertIn(expected, filters)
                    self.assertGreater(int(self.attribute(html, "explore-visible")), 0)
                    self.assertLess(int(self.attribute(html, "explore-visible")), count)

    def test_detail_keeps_bilingual_source_and_favorite(self):
        article = f"{1:064x}"
        for width in (390, 800, 1280):
            with self.subTest(width=width):
                html = self.dump(f"/daily/ai/?date={DATE}&article={article}", width, 14)
                self.assertNotEqual(self.attribute(html, "detail-english"), "0")
                self.assertNotEqual(self.attribute(html, "detail-chinese"), "0")
                self.assertEqual(self.attribute(html, "original-link"), "true")
                self.assertEqual(self.attribute(html, "favorite"), "true")
                self.assertEqual(self.attribute(html, "detail-order"), "true")
                self.assertEqual(self.attribute(html, "overflow"), "false")
