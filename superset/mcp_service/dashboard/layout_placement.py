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

"""
Shared layout-placement helpers for MCP tools that insert new components
into a dashboard's ``position_json`` tree.

Extracted from ``add_chart_to_existing_dashboard`` so that other
layout-mutating tools (e.g. ``manage_dashboard_markdown``) can resolve the
same GRID/TABS insertion target and scaffold the same GRID/ROOT structure
without duplicating the tab-matching logic.
"""

import re
from typing import Any, Dict

from superset.mcp_service.dashboard.constants import generate_id

# Compiled regex for stripping common emoji Unicode ranges from tab text.
# Uses specific Unicode blocks to avoid overly permissive ranges.
_EMOJI_RE = re.compile(
    "["
    "\U0001f300-\U0001f5ff"  # Misc Symbols and Pictographs
    "\U0001f600-\U0001f64f"  # Emoticons
    "\U0001f680-\U0001f6ff"  # Transport and Map Symbols
    "\U0001f900-\U0001f9ff"  # Supplemental Symbols and Pictographs
    "\U0001fa70-\U0001faff"  # Symbols and Pictographs Extended-A
    "☀-⛿"  # Misc Symbols
    "✀-➿"  # Dingbats
    "︀-️"  # Variation Selectors
    "‍"  # Zero-width joiner
    "]+"
)


# Container types that should be deleted once they have no children left.
# TAB/TABS/GRID/ROOT containers are intentionally kept even when empty —
# deleting a TAB would silently change the dashboard's visible structure.
_PRUNABLE_TYPES = ("ROW", "COLUMN")


def _find_parent_key(layout: Dict[str, Any], component_key: str) -> str | None:
    """Find the component whose children list contains *component_key*.

    The reverse lookup scans children lists instead of trusting the
    ``parents`` metadata on the node, which can be stale in hand-edited or
    programmatically generated layouts.
    """
    for key, node in layout.items():
        if not isinstance(node, dict):
            continue
        children = node.get("children")
        if isinstance(children, list) and component_key in children:
            return key
    return None


def _remove_component_and_prune(
    layout: Dict[str, Any], component_key: str
) -> list[str]:
    """Remove *component_key* from the layout and prune empty containers.

    Walks up the parent chain deleting ROW/COLUMN containers that become
    empty as a result of the removal, so no orphaned wrapper nodes are left
    behind. Returns the list of removed layout keys.
    """
    removed: list[str] = []
    parent_key = _find_parent_key(layout, component_key)

    layout.pop(component_key, None)
    removed.append(component_key)

    child_key = component_key
    while parent_key is not None:
        parent = layout.get(parent_key)
        if not isinstance(parent, dict):
            break
        children = parent.get("children")
        if isinstance(children, list):
            parent["children"] = [c for c in children if c != child_key]
        if parent.get("type") in _PRUNABLE_TYPES and not parent.get("children"):
            grandparent_key = _find_parent_key(layout, parent_key)
            layout.pop(parent_key, None)
            removed.append(parent_key)
            child_key = parent_key
            parent_key = grandparent_key
        else:
            break

    return removed


def _find_next_row_position(layout: Dict[str, Any]) -> str:
    """
    Generate a unique ROW ID for a new row in the dashboard layout.

    Uses UUID-based IDs (e.g. ``ROW-a1b2c3d4``) instead of numeric indices
    so that the IDs are compatible with real dashboard layouts that use
    nanoid-style identifiers.

    Returns:
        A new unique ROW ID string.
    """
    row_key = generate_id("ROW")
    # Ensure uniqueness (extremely unlikely collision, but safe)
    while row_key in layout:
        row_key = generate_id("ROW")
    return row_key


def _normalize_tab_text(text: str | None) -> str:
    """Strip emoji and extra whitespace from tab text for flexible matching."""
    if not text:
        return ""
    cleaned = _EMOJI_RE.sub("", text)
    return cleaned.strip().lower()


def _match_tab_in_children(
    layout: Dict[str, Any],
    tabs_children: list[str],
    target_tab: str,
) -> str | None:
    """Search tabs_children for a tab matching target_tab by ID or name.

    Matching is flexible: exact ID match, exact text match, or
    case-insensitive text match after stripping emoji characters.
    """
    target_normalized = _normalize_tab_text(target_tab)
    for tab_id in tabs_children:
        tab = layout.get(tab_id)
        if not tab or tab.get("type") != "TAB":
            continue
        tab_text = (tab.get("meta") or {}).get("text", "")
        # Exact match on ID or text
        if target_tab in (tab_id, tab_text):
            return tab_id
        # Flexible match: case-insensitive, emoji-stripped
        if target_normalized and _normalize_tab_text(tab_text) == target_normalized:
            return tab_id
    return None


def _collect_tabs_groups(layout: Dict[str, Any]) -> list[list[str]]:
    """Collect all TABS groups from ROOT_ID and GRID_ID children.

    Superset dashboards can place TABS under either ROOT_ID or GRID_ID
    depending on how the layout was constructed.
    """
    groups: list[list[str]] = []
    for parent_key in ("ROOT_ID", "GRID_ID"):
        parent = layout.get(parent_key)
        if not parent:
            continue
        for child_id in parent.get("children", []):
            child = layout.get(child_id)
            if not child or child.get("type") != "TABS":
                continue
            tabs_children = child.get("children", [])
            if tabs_children:
                groups.append(tabs_children)
    return groups


def _first_tab_from_groups(
    layout: Dict[str, Any], groups: list[list[str]]
) -> str | None:
    """Return the first valid TAB ID from the collected groups."""
    for tabs_children in groups:
        first_tab_id = tabs_children[0]
        first_tab = layout.get(first_tab_id)
        if first_tab and first_tab.get("type") == "TAB":
            return first_tab_id
    return None


def _collect_available_tab_names(layout: Dict[str, Any]) -> list[str]:
    """Collect display entries (label + component ID) for all TAB components.

    Always includes the component ID so callers can retry unambiguously even
    when multiple tabs share the same display name or a label is blank.
    """
    entries: list[str] = []
    for tabs_children in _collect_tabs_groups(layout):
        for tab_id in tabs_children:
            tab = layout.get(tab_id)
            if not tab or tab.get("type") != "TAB":
                continue
            text = (tab.get("meta") or {}).get("text", "")
            entries.append(f"{text} ({tab_id})" if text else tab_id)
    return entries


def _find_tab_insert_target(
    layout: Dict[str, Any], target_tab: str | None = None
) -> str | None:
    """
    Detect if the dashboard uses tabs and return the appropriate tab's ID.

    When *target_tab* is ``None`` the function returns the first TAB child so
    that new rows are placed inside the tab structure rather than directly
    under ``GRID_ID``.

    When *target_tab* is provided the function tries to match it against tab
    ``meta.text`` (display name) or the raw component ID.  If no match is
    found ``None`` is returned — the caller is responsible for surfacing an
    error rather than silently placing the chart in the wrong tab.

    Returns:
        The ID of the matched (or first) TAB component, or ``None``.
    """
    groups = _collect_tabs_groups(layout)

    if target_tab is not None:
        for tabs_children in groups:
            matched = _match_tab_in_children(layout, tabs_children, target_tab)
            if matched:
                return matched
        # target_tab specified but not found — signal mismatch to the caller.
        return None

    return _first_tab_from_groups(layout, groups)


def _ensure_layout_structure(
    layout: Dict[str, Any], component_key: str, parent_id: str
) -> None:
    """
    Ensure the dashboard layout has proper GRID and ROOT structure,
    and add the new component to the correct parent container.

    Args:
        layout: The mutable layout dict to update.
        component_key: The top-level component ID to insert (a ROW, or a
            GRID/TAB-level component such as HEADER or DIVIDER).
        parent_id: The container to add the component to (GRID_ID or a TAB ID).
    """
    # Ensure GRID structure exists
    if "GRID_ID" not in layout:
        layout["GRID_ID"] = {
            "children": [],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        }

    # Add the component to the target parent container
    if parent := layout.get(parent_id):
        if "children" not in parent:
            parent["children"] = []
        parent["children"].append(component_key)
    else:
        # Fallback: add to GRID_ID
        if "children" not in layout["GRID_ID"]:
            layout["GRID_ID"]["children"] = []
        layout["GRID_ID"]["children"].append(component_key)

    # Update ROOT_ID if it exists, or create it
    if "ROOT_ID" in layout:
        if "children" not in layout["ROOT_ID"]:
            layout["ROOT_ID"]["children"] = []
        # Only add GRID_ID to ROOT_ID when TABS are not already a direct
        # child of ROOT_ID.  Real Superset dashboards with tabs place a
        # TABS container directly under ROOT_ID (ROOT_ID → TABS → TABs).
        # Adding GRID_ID as a sibling of TABS confuses the frontend layout
        # engine and makes charts invisible.
        root_children = layout["ROOT_ID"]["children"]
        has_tabs_under_root = any(
            layout.get(c, {}).get("type") == "TABS" for c in root_children
        )
        if not has_tabs_under_root and "GRID_ID" not in root_children:
            root_children.append("GRID_ID")
    else:
        # Create ROOT_ID if it doesn't exist
        layout["ROOT_ID"] = {
            "children": ["GRID_ID"],
            "id": "ROOT_ID",
            "type": "ROOT",
        }

    # Ensure dashboard version
    if "DASHBOARD_VERSION_KEY" not in layout:
        layout["DASHBOARD_VERSION_KEY"] = "v2"
