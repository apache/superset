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

Example datasets are stored as Parquet files organized by example name:
    superset/examples/{example_name}/data.parquet

Parquet is an Apache-friendly, compressed columnar format.
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

EXAMPLES_PROTOCOL = "examples://"

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
    return os.path.join(current_app.config["BASE_DIR"], "examples")


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
