import re
from pathlib import Path

from lxml import html

root_dir = Path(__file__).resolve().parents[1]
page = root_dir / "public" / "index.html"
js = root_dir / "public" / "app.js"

tree = html.parse(str(page))
ids = [element.get("id") for element in tree.getroot().iter() if element.get("id")]
need = set(re.findall(r"\$\('([^']+)'\)", js.read_text(encoding="utf-8")))

print("ids:", len(ids))
print("duplicates:", sorted({item for item in ids if ids.count(item) > 1}))
print("missing in html:", sorted(need - set(ids)))
print("unused ids:", sorted(set(ids) - need))
