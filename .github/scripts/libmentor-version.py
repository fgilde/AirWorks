import json
import os
from pathlib import Path
import xml.etree.ElementTree as ET

version = json.loads(Path("src/airworks/package.json").read_text())["version"]
if not version:
    raise SystemExit("Library version could not be resolved.")
revision = os.environ.get("GITHUB_SHA", "local")[:12]
base = version.split("+", 1)[0]
print(base + (".source." if "-" in base else "-source.") + revision)
