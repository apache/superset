import json
from pathlib import Path
from typing import Any

import tomli


def read_toml(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None

    with path.open("rb") as f:
        return tomli.load(f)


def read_json(path: Path) -> dict[str, Any] | None:
    path = Path(path)
    if not path.is_file():
        return None

    return json.loads(path.read_text())
