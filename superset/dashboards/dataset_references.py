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
"""Dataset references stored in a dashboard's ``json_metadata``.

Native filters and display controls (``chart_customization_config``) target
datasets by id from untyped JSON, independent of the dashboard's charts, so
anything asking which dashboards depend on a dataset has to read them here.
"""

from __future__ import annotations

from typing import Any

from superset.utils import json

#: ``json_metadata`` keys whose entries carry ``targets[].datasetId``.
DATASET_TARGETING_KEYS = ("native_filter_configuration", "chart_customization_config")


def coerce_dataset_id(raw_dataset_id: Any) -> int | None:
    if isinstance(raw_dataset_id, bool):
        return None
    if isinstance(raw_dataset_id, int):
        return raw_dataset_id
    if isinstance(raw_dataset_id, str) and raw_dataset_id.isdigit():
        try:
            return int(raw_dataset_id)
        except ValueError:
            return None
    return None


def parse_dashboard_metadata(json_metadata: str | None) -> dict[str, Any]:
    """Parse ``json_metadata``, returning ``{}`` when it is absent or unusable."""
    if not json_metadata:
        return {}
    try:
        metadata = json.loads(json_metadata)
    except (TypeError, ValueError):
        return {}
    return metadata if isinstance(metadata, dict) else {}


def dashboard_dataset_ids(metadata: dict[str, Any]) -> set[int]:
    """Dataset ids a dashboard's native filters and display controls target.

    A semantic-view target's ``datasetId`` names a view, not a table, so it is
    left out here, as ``export_dashboard_references`` leaves it out for tables.
    Malformed configuration (non-list entries, missing or non-dict targets) is
    ignored rather than raising.
    """
    dataset_ids: set[int] = set()
    for key in DATASET_TARGETING_KEYS:
        entries = metadata.get(key)
        if not isinstance(entries, list):
            continue
        for entry in entries:
            targets = entry.get("targets") if isinstance(entry, dict) else None
            if not isinstance(targets, list):
                continue
            for target in targets:
                if (
                    isinstance(target, dict)
                    and target.get("datasourceType") in (None, "table")
                    and (dataset_id := coerce_dataset_id(target.get("datasetId")))
                    is not None
                ):
                    dataset_ids.add(dataset_id)
    return dataset_ids
