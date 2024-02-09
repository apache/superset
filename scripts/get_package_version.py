import json
import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PACKAGE_JSON = os.path.join(BASE_DIR, "../", "superset-frontend", "package.json")


if os.path.exists(PACKAGE_JSON):
    # package.json is the source of truth for version info
    with open(PACKAGE_JSON) as f:
        print(json.load(f)["version"])
