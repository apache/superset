# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""Helpers for loading Superset example datasets.

Historically we fetched the sample files straight from
``raw.githubusercontent.com``.  Anonymous requests are limited to **60 per
hour per IP** on GitHub, so our busy CI matrix started to hit 429s.

We now point to **jsDelivr** – a multi‑CDN cache in front of every public
GitHub repo.  It doesn’t consume the GitHub API quota and advertises
unlimited bandwidth for OSS.

*Docs →* https://www.jsdelivr.com/github

Environment knobs
-----------------
``SUPERSET_EXAMPLES_DATA_REF``  (default: ``master``)
    Tag / branch / SHA to pin so builds remain reproducible.

``SUPERSET_EXAMPLES_BASE_URL``
    Override the base completely if you want to host the files elsewhere
    (internal mirror, S3 bucket, ASF downloads, …).  **Include any query
    string required by your hosting (e.g. ``?raw=true`` if you point back
    to a GitHub *blob* URL).**

jsDelivr URL pattern::

    https://cdn.jsdelivr.net/gh/<owner>/<repo>@<ref>/<path>

Example::

    https://cdn.jsdelivr.net/gh/apache-superset/examples-data@master/iris.csv
"""

from __future__ import annotations

import os
from typing import Any

from superset import app, db
from superset.connectors.sqla.models import SqlaTable
from superset.models.slice import Slice
from superset.utils import json

# ---------------------------------------------------------------------------
# Public sample‑data mirror configuration
# ---------------------------------------------------------------------------
BASE_COMMIT: str = os.getenv("SUPERSET_EXAMPLES_DATA_REF", "master")
BASE_URL: str = os.getenv(
    "SUPERSET_EXAMPLES_BASE_URL",
    f"https://cdn.jsdelivr.net/gh/apache-superset/examples-data@{BASE_COMMIT}/",
)

# Slices assembled into a 'Misc Chart' dashboard
misc_dash_slices: set[str] = set()

# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------


def get_table_connector_registry() -> Any:
    """Return the SqlaTable registry so we can mock it in unit tests."""

    return SqlaTable


def get_examples_folder() -> str:
    """Return local path to the examples folder (when vendored)."""

    return os.path.join(app.config["BASE_DIR"], "examples")


def update_slice_ids(pos: dict[Any, Any]) -> list[Slice]:
    """Update slice ids in ``position_json`` and return the slices found."""

    slice_components = [
        component
        for component in pos.values()
        if isinstance(component, dict) and component.get("type") == "CHART"
    ]
    slices: dict[str, Slice] = {}
    for name in {component["meta"]["sliceName"] for component in slice_components}:
        slc = db.session.query(Slice).filter_by(slice_name=name).first()
        if slc:
            slices[name] = slc
    for component in slice_components:
        slc = slices.get(component["meta"]["sliceName"])
        if slc:
            component["meta"]["chartId"] = slc.id
            component["meta"]["uuid"] = str(slc.uuid)
    return list(slices.values())


def merge_slice(slc: Slice) -> None:
    """Upsert a Slice by name."""

    existing = db.session.query(Slice).filter_by(slice_name=slc.slice_name).first()
    if existing:
        db.session.delete(existing)
    db.session.add(slc)


def get_slice_json(defaults: dict[Any, Any], **kwargs: Any) -> str:
    """Return JSON string for a chart definition, merging extra kwargs."""

    defaults_copy = defaults.copy()
    defaults_copy.update(kwargs)
    return json.dumps(defaults_copy, indent=4, sort_keys=True)


def get_example_url(filepath: str) -> str:
    """Return an absolute URL to *filepath* under the examples‑data repo.

    The function simply concatenates ``BASE_URL`` and ``filepath``.
    If your override in ``SUPERSET_EXAMPLES_BASE_URL`` needs a query string
    (for instance GitHub’s ``...?raw=true``) include it **in the override**.
    """

    return f"{BASE_URL}{filepath}"
