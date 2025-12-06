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

Example datasets are stored as DuckDB files in the superset/examples/data/
directory. Each dataset is a self-contained DuckDB file with schema and data.
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
        url: URL to normalize (e.g., "examples://birth_names" or "birth_names.duckdb")

    Returns:
        Normalized file:// URL pointing to the DuckDB file
    """
    import os

    # Handle existing examples:// protocol
    if url.startswith(EXAMPLES_PROTOCOL):
        # Remove the protocol for processing
        path = url[len(EXAMPLES_PROTOCOL) :]
    elif url.startswith("file://"):
        # Already a file URL, just return it
        return url
    else:
        path = url

    # Ensure .duckdb extension
    if not path.endswith(".duckdb"):
        path = f"{path}.duckdb"

    # Build the full file path
    full_path = os.path.join(get_examples_folder(), "data", path)

    # Convert to file:// URL for schema validation
    # This will pass URL validation and still work with our loader
    return f"file://{full_path}"


def read_example_data(
    filepath: str,
    table_name: str | None = None,
    **kwargs: Any,
) -> pd.DataFrame:
    """Load data from local DuckDB files.

    Args:
        filepath: Path to the DuckDB file (e.g., "examples://birth_names.duckdb" or "file:///path/to/file.duckdb")
        table_name: Table to read from DuckDB (defaults to filename without extension)
        **kwargs: Ignored (kept for backward compatibility)

    Returns:
        DataFrame with the loaded data
    """
    import os

    import duckdb

    # Handle different URL formats
    if filepath.startswith(EXAMPLES_PROTOCOL):
        # examples:// protocol
        relative_path = filepath[len(EXAMPLES_PROTOCOL) :]
        if not relative_path.endswith(".duckdb"):
            relative_path = f"{relative_path}.duckdb"
        local_path = os.path.join(get_examples_folder(), "data", relative_path)
    elif filepath.startswith("file://"):
        # file:// protocol - extract the actual path
        local_path = filepath[7:]  # Remove "file://"
    else:
        # Assume it's a relative path
        relative_path = filepath
        if not relative_path.endswith(".duckdb"):
            relative_path = f"{relative_path}.duckdb"
        local_path = os.path.join(get_examples_folder(), "data", relative_path)

    if not os.path.exists(local_path):
        raise FileNotFoundError(f"Example data file not found: {local_path}")

    # Determine table name if not provided
    if table_name is None:
        base_name = os.path.basename(local_path)
        table_name = os.path.splitext(base_name)[0]

    # Connect and read from DuckDB
    conn = duckdb.connect(local_path, read_only=True)
    try:
        df = conn.execute(f"SELECT * FROM {table_name}").df()  # noqa: S608
        return df
    finally:
        conn.close()
