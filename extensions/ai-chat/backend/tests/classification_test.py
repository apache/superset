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

from enx_dev.ai_chat.classification import (
    approval_warnings,
    classify_tool,
    is_reversible,
    requires_approval,
)
from enx_dev.ai_chat.types import redact_sensitive, ToolClassification
from flask.ctx import AppContext

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


def test_requires_approval_read_only_never(app_context: AppContext) -> None:
    assert requires_approval(ToolClassification.READ_ONLY) is False


def test_requires_approval_mutating_follows_config(
    app_context: AppContext,
) -> None:
    from flask import current_app

    config = current_app.config["AI_CHAT_CONFIG"]
    original = config.get("REQUIRE_APPROVAL_FOR_MUTATIONS", True)
    try:
        config["REQUIRE_APPROVAL_FOR_MUTATIONS"] = True
        assert requires_approval(ToolClassification.MUTATING) is True
        config["REQUIRE_APPROVAL_FOR_MUTATIONS"] = False
        assert requires_approval(ToolClassification.MUTATING) is False
    finally:
        config["REQUIRE_APPROVAL_FOR_MUTATIONS"] = original


def test_requires_approval_destructive_and_unknown_always(
    app_context: AppContext,
) -> None:
    from flask import current_app

    config = current_app.config["AI_CHAT_CONFIG"]
    original = config.get("REQUIRE_APPROVAL_FOR_MUTATIONS", True)
    try:
        # Even when the operator disables approvals for plain mutations,
        # destructive and unknown tools still require approval.
        config["REQUIRE_APPROVAL_FOR_MUTATIONS"] = False
        assert requires_approval(ToolClassification.DESTRUCTIVE) is True
        assert requires_approval(ToolClassification.UNKNOWN) is True
    finally:
        config["REQUIRE_APPROVAL_FOR_MUTATIONS"] = original


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
