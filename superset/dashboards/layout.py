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

"""Structural repair for a dashboard's ``position_json``."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

ROOT_ID = "ROOT_ID"
# ``HEADER_ID`` is dashboard metadata rather than a rendered child, and a
# dashboard with top-level tabs keeps an empty, detached ``GRID_ID``. Both are
# unreachable by design. Mirrors the reserved ids in the frontend's
# ``removeUnreachableComponents``.
RESERVED_IDS = frozenset({ROOT_ID, "GRID_ID", "HEADER_ID"})


def remove_unreachable_components(
    position: dict[str, Any],
) -> tuple[dict[str, Any], list[str]]:
    """Drop layout components that cannot be reached from ``ROOT_ID``.

    Superset renders only what hangs off ``ROOT_ID``, so a detached component is
    already invisible. It still survives in ``position_json``, where code that
    walks every entry or trusts a node's stale ``parents`` can find it — a
    detached subtree holding a cycle is what crashes the filter scope modal with
    "Maximum call stack size exceeded". Dropping such a subtree also releases any
    chart trapped inside: the dashboard keeps the chart in ``slices``, so the
    frontend places it back into the layout on the next load.

    Returns the (possibly unchanged) position and the ids that were removed.
    Non-dict entries such as ``DASHBOARD_VERSION_KEY`` are never removed.
    """
    if not isinstance(position, dict) or not isinstance(position.get(ROOT_ID), dict):
        return position, []

    reachable: set[str] = set()
    stack: list[str] = [ROOT_ID]
    while stack:
        component_id = stack.pop()
        # doubles as the cycle guard: an id already seen is never expanded twice
        if component_id in reachable:
            continue
        reachable.add(component_id)
        component = position.get(component_id)
        if isinstance(component, dict):
            for child_id in component.get("children") or []:
                if child_id in position:
                    stack.append(child_id)

    removed = [
        component_id
        for component_id, component in position.items()
        if isinstance(component, dict)
        and component_id not in reachable
        and component_id not in RESERVED_IDS
    ]
    if not removed:
        return position, []

    return {
        component_id: component
        for component_id, component in position.items()
        if component_id not in removed
    }, removed


def repair_position(
    position: dict[str, Any], dashboard_id: Any = None
) -> dict[str, Any]:
    """Return *position* with detached components dropped, logging what went.

    Thin wrapper over ``remove_unreachable_components`` for the write paths,
    which care about the repaired layout rather than the removed ids.
    """
    repaired, removed = remove_unreachable_components(position)
    if removed:
        logger.warning(
            "Dashboard %s: dropped %d layout component(s) unreachable from ROOT_ID: %s",
            dashboard_id,
            len(removed),
            ", ".join(sorted(removed)),
        )
    return repaired
