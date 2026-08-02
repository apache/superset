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
"""Server-side tool impact classification and approval policy.

This module answers "may this call run now" on its own: what class of tool it
is, and whether the configured :class:`ToolApprovalMode` gates that class.
Changing the policy means changing this file, not the orchestrator, the API
or the browser.

Classification derives from the ``readOnlyHint`` and ``destructiveHint``
annotations every MCP tool declares, so it is code deciding rather than the
model.
"""

from __future__ import annotations

from typing import Any, Mapping

from enx_dev.ai_chat.types import ToolApprovalMode, ToolClassification

# Extra human-readable warnings surfaced in the approval card for specific
# tools. Presentation only: enforcement does not depend on this map.
TOOL_APPROVAL_WARNINGS: dict[str, list[str]] = {
    "delete_dashboard": [
        "Deletes a dashboard. If soft-delete is enabled it can be restored "
        "from trash; otherwise the deletion is permanent.",
    ],
    "delete_chart": [
        "Deletes a chart. If soft-delete is enabled it can be restored "
        "from trash; otherwise the deletion is permanent.",
    ],
    "execute_sql": [
        "Runs SQL against the selected database. Destructive statements "
        "(DROP/TRUNCATE/ALTER) are blocked; other writes depend on the "
        "database's DML settings.",
    ],
    "update_dashboard": [
        "Overwrites dashboard properties shared with other users.",
    ],
    "update_chart": [
        "Overwrites chart configuration shared with other users.",
    ],
    "manage_dashboard_owners": [
        "Changes who can edit this dashboard.",
    ],
    "manage_dashboard_roles": [
        "Changes which roles can access this dashboard.",
    ],
    "remove_chart_from_dashboard": [
        "Removes a chart from a dashboard other users may rely on.",
    ],
}


def classify_tool(annotations: Mapping[str, Any] | None) -> ToolClassification:
    """Derive the impact class from declared MCP tool annotations."""
    if not annotations:
        return ToolClassification.UNKNOWN
    read_only = annotations.get("readOnlyHint")
    destructive = annotations.get("destructiveHint")
    if read_only is True:
        return ToolClassification.READ_ONLY
    if destructive is True:
        return ToolClassification.DESTRUCTIVE
    if read_only is False:
        return ToolClassification.MUTATING
    return ToolClassification.UNKNOWN


def requires_approval(
    tool_classification: ToolClassification,
    approval_mode: ToolApprovalMode,
) -> bool:
    """Whether this call must be confirmed by the user before it runs.

    The mode is passed in rather than read here, so the answer cannot drift
    between the check and the call it guards.

    ``MUTATIONS_ONLY`` gates everything but read-only tools, ``UNKNOWN``
    included: an allowlisted tool that declares no annotations must not be
    the cheapest way past the gate.
    """
    if approval_mode == ToolApprovalMode.DISABLED:
        return False
    if approval_mode == ToolApprovalMode.ALL_TOOLS:
        return True
    return tool_classification != ToolClassification.READ_ONLY


def is_reversible(classification: ToolClassification) -> bool:
    """Best-effort reversibility hint shown in the approval card.

    Mutating operations that are not destructive are generally reversible by
    a follow-up edit, while destructive and unknown operations are presented
    as not reversible.
    """
    return classification == ToolClassification.MUTATING


def approval_warnings(tool_name: str, classification: ToolClassification) -> list[str]:
    """What the approval prompt should warn about before the user decides."""
    warnings = list(TOOL_APPROVAL_WARNINGS.get(tool_name, []))
    if classification == ToolClassification.DESTRUCTIVE:
        warnings.append("This action is classified as destructive.")
    if classification == ToolClassification.UNKNOWN:
        warnings.append(
            "This tool's impact is unknown; treat it as potentially destructive."
        )
    return warnings
