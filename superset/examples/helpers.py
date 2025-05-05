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

All Superset example data files (CSV, JSON, etc.) are fetched via the
jsDelivr CDN instead of raw.githubusercontent.com to avoid GitHub API
rate limits (60 anonymous requests/hour/IP).

jsDelivr is a multi‑CDN front for public GitHub repos and supports
arbitrary paths including nested folders. It doesn’t use the GitHub REST API
and advertises unlimited bandwidth for open-source use.

Example URL::

    https://cdn.jsdelivr.net/gh/apache-superset/examples-data@master/datasets/examples/slack/messages.csv

Environment knobs
-----------------
``SUPERSET_EXAMPLES_DATA_REF``  (default: ``master``)
    Tag / branch / SHA to pin so builds remain reproducible.

``SUPERSET_EXAMPLES_BASE_URL``
    Override the base completely if you want to host the files elsewhere
    (internal mirror, S3 bucket, ASF downloads, …).  **Include any query
    string required by your hosting (e.g. ``?raw=true`` if you point back
    to a GitHub *blob* URL).**
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

    All calls are routed through jsDelivr unless overridden. Supports nested
    paths like ``datasets/examples/slack/messages.csv``.
    """
    return f"{BASE_URL}{filepath}"
