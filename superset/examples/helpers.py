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

<<<<<<< HEAD
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
=======
Example datasets are stored as Parquet files organized by example name:
    superset/examples/{example_name}/data.parquet

Parquet is an Apache-friendly, compressed columnar format.
>>>>>>> origin/master
"""

from __future__ import annotations

import os
from typing import Any

import pandas as pd
from flask import current_app

from superset import db
from superset.connectors.sqla.models import SqlaTable
from superset.models.slice import Slice
from superset.utils import json

<<<<<<< HEAD
# ---------------------------------------------------------------------------
# Public sample‑data mirror configuration
# ---------------------------------------------------------------------------
BASE_COMMIT: str = os.getenv("SUPERSET_EXAMPLES_DATA_REF", "master")
BASE_URL: str = os.getenv(
    "SUPERSET_EXAMPLES_BASE_URL",
    f"https://cdn.jsdelivr.net/gh/apache-superset/examples-data@{BASE_COMMIT}/",
)
=======
EXAMPLES_PROTOCOL = "examples://"
>>>>>>> origin/master

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
<<<<<<< HEAD
    return os.path.join(app.config["BASE_DIR"], "examples")
=======
    return os.path.join(current_app.config["BASE_DIR"], "examples")
>>>>>>> origin/master


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


<<<<<<< HEAD
def get_example_url(filepath: str) -> str:
    """Return an absolute URL to *filepath* under the examples‑data repo.

    All calls are routed through jsDelivr unless overridden. Supports nested
    paths like ``datasets/examples/slack/messages.csv``.
    """
    return f"{BASE_URL}{filepath}"
=======
def normalize_example_data_url(url: str) -> str:
    """Normalize example data URLs for consistency.

    This function ensures that example data URLs are properly formatted.
    Since the schema validator expects valid URLs and our examples:// protocol
    isn't standard, we convert to file:// URLs pointing to the actual location.

    Args:
        url: URL to normalize (e.g., "examples://birth_names")

    Returns:
        Normalized file:// URL pointing to the Parquet file, or the original URL
        if it's a remote URL (http://, https://, etc.)
    """
    import os

    # Handle existing examples:// protocol
    if url.startswith(EXAMPLES_PROTOCOL):
        # Remove the protocol for processing
        example_name = url[len(EXAMPLES_PROTOCOL) :]
    elif url.startswith(("file://", "http://", "https://", "s3://", "gs://")):
        # Already a valid URL protocol, return as-is
        return url
    else:
        # Assume it's a local example name
        example_name = url

    # Strip any extension
    for ext in (".parquet", ".csv", ".gz"):
        if example_name.endswith(ext):
            example_name = example_name[: -len(ext)]
            break

    # Normalize name (lowercase, underscores)
    example_name = example_name.lower().replace(" ", "_").replace("-", "_")

    # Build the full file path: {examples_folder}/{example_name}/data.parquet
    examples_folder = get_examples_folder()
    full_path = os.path.join(examples_folder, example_name, "data.parquet")

    # Security: Ensure the path doesn't traverse outside examples folder
    full_path = os.path.abspath(full_path)
    examples_folder = os.path.abspath(examples_folder)
    if not full_path.startswith(examples_folder + os.sep):
        raise ValueError(f"Invalid path: {example_name} attempts directory traversal")

    # Convert to file:// URL for schema validation
    return f"file://{full_path}"


def read_example_data(
    filepath: str,
    table_name: str | None = None,
    **kwargs: Any,
) -> pd.DataFrame:
    """Load data from local Parquet files.

    Examples are organized as:
        superset/examples/{example_name}/data.parquet

    Args:
        filepath: Example name (e.g., "examples://birth_names" or just "birth_names")
        table_name: Ignored (kept for backward compatibility)
        **kwargs: Ignored (kept for backward compatibility)

    Returns:
        DataFrame with the loaded data
    """
    import os

    # Extract example name from filepath
    if filepath.startswith(EXAMPLES_PROTOCOL):
        example_name = filepath[len(EXAMPLES_PROTOCOL) :]
    elif filepath.startswith("file://"):
        # file:// protocol - use as-is for direct file access
        return pd.read_parquet(filepath[7:])
    else:
        example_name = filepath

    # Strip any extension
    for ext in (".parquet", ".csv", ".gz"):
        if example_name.endswith(ext):
            example_name = example_name[: -len(ext)]
            break

    # Normalize name (lowercase, underscores)
    example_name = example_name.lower().replace(" ", "_").replace("-", "_")

    # Build path: {examples_folder}/{example_name}/data.parquet
    local_path = os.path.join(get_examples_folder(), example_name, "data.parquet")

    if not os.path.exists(local_path):
        raise FileNotFoundError(f"Example data file not found: {local_path}")

    return pd.read_parquet(local_path)
>>>>>>> origin/master
