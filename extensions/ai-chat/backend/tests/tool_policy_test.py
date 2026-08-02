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
from __future__ import annotations

import itertools

import pytest
from enx_dev.ai_chat.tool_policy import (
    approval_warnings,
    classify_tool,
    is_reversible,
    requires_approval,
)
from enx_dev.ai_chat.types import (
    redact_sensitive,
    ToolApprovalMode,
    ToolClassification,
)

REDACTED = "***redacted***"


def test_classify_read_only() -> None:
    assert (
        classify_tool({"readOnlyHint": True, "destructiveHint": False})
        == ToolClassification.READ_ONLY
    )


def test_classify_destructive() -> None:
    assert (
        classify_tool({"readOnlyHint": False, "destructiveHint": True})
        == ToolClassification.DESTRUCTIVE
    )


def test_classify_mutating() -> None:
    assert (
        classify_tool({"readOnlyHint": False, "destructiveHint": False})
        == ToolClassification.MUTATING
    )


def test_classify_missing_annotations_is_unknown() -> None:
    assert classify_tool(None) == ToolClassification.UNKNOWN
    assert classify_tool({}) == ToolClassification.UNKNOWN
    assert classify_tool({"title": "No hints"}) == ToolClassification.UNKNOWN


def test_classify_conflicting_hints_prefers_read_only_declaration() -> None:
    # readOnlyHint=True wins: the tool declared it does not mutate.
    assert (
        classify_tool({"readOnlyHint": True, "destructiveHint": True})
        == ToolClassification.READ_ONLY
    )


@pytest.mark.parametrize("classification", list(ToolClassification))
def test_disabled_gates_nothing(classification: ToolClassification) -> None:
    """Every class, destructive included, runs directly in the default mode.

    Only the confirmation step is gone: authentication, the allowlist,
    validation and RBAC still apply.
    """
    assert requires_approval(classification, ToolApprovalMode.DISABLED) is False


@pytest.mark.parametrize("classification", list(ToolClassification))
def test_all_tools_gates_everything(classification: ToolClassification) -> None:
    assert requires_approval(classification, ToolApprovalMode.ALL_TOOLS) is True


def test_mutations_only_lets_read_only_through() -> None:
    assert (
        requires_approval(ToolClassification.READ_ONLY, ToolApprovalMode.MUTATIONS_ONLY)
        is False
    )


@pytest.mark.parametrize(
    "classification",
    [
        ToolClassification.MUTATING,
        ToolClassification.DESTRUCTIVE,
        ToolClassification.UNKNOWN,
    ],
)
def test_mutations_only_gates_everything_else(
    classification: ToolClassification,
) -> None:
    """UNKNOWN is gated with the rest, so an unannotated tool is not the
    cheapest way past."""
    assert requires_approval(classification, ToolApprovalMode.MUTATIONS_ONLY) is True


def test_policy_matrix_is_exhaustive() -> None:
    """Only the documented cells go ungated. A new mode or class fails here
    until it is deliberately placed."""
    ungated = {
        pair
        for pair in itertools.product(ToolClassification, ToolApprovalMode)
        if not requires_approval(*pair)
    }
    assert ungated == {
        *((c, ToolApprovalMode.DISABLED) for c in ToolClassification),
        (ToolClassification.READ_ONLY, ToolApprovalMode.MUTATIONS_ONLY),
    }


def test_policy_reads_no_configuration() -> None:
    """A pure function of its two arguments.

    These run with no application context at all, so nothing can be read
    from config behind the caller's back.
    """
    assert (
        requires_approval(ToolClassification.DESTRUCTIVE, ToolApprovalMode.DISABLED)
        is False
    )
    assert (
        requires_approval(ToolClassification.READ_ONLY, ToolApprovalMode.ALL_TOOLS)
        is True
    )


def test_reversibility_hints() -> None:
    assert is_reversible(ToolClassification.MUTATING) is True
    assert is_reversible(ToolClassification.DESTRUCTIVE) is False
    assert is_reversible(ToolClassification.UNKNOWN) is False


def test_approval_warnings_for_destructive_and_unknown() -> None:
    warnings = approval_warnings("delete_dashboard", ToolClassification.DESTRUCTIVE)
    assert any("destructive" in warning.lower() for warning in warnings)
    assert any("trash" in warning.lower() for warning in warnings)

    unknown_warnings = approval_warnings("some_new_tool", ToolClassification.UNKNOWN)
    assert any("unknown" in warning.lower() for warning in unknown_warnings)


def test_redact_sensitive_masks_secret_keys() -> None:
    redacted = redact_sensitive(
        {
            "request": {
                "database_id": 1,
                "password": "hunter2",
                "nested": {"api_key": "abc", "sql": "SELECT 1"},
                "items": [{"access_token": "zzz", "name": "ok"}],
            }
        }
    )
    request = redacted["request"]
    assert request["database_id"] == 1
    assert request["password"] == REDACTED
    assert request["nested"]["api_key"] == REDACTED
    assert request["nested"]["sql"] == "SELECT 1"
    assert request["items"][0]["access_token"] == REDACTED
    assert request["items"][0]["name"] == "ok"
