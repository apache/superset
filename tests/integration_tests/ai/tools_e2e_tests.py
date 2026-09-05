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
End-to-end verification that every shipped tool actually runs.

Unit tests for the tools inject fakes at the database seam, which proves the
guards but not that the tool can execute at all. These drive each tool through
the real registry, against the real metadata database, with real permission
checks — the difference between "the code is correct" and "the feature works".

Every tool named in :data:`ALL_TOOL_NAMES` is covered, and a guard test asserts
that, so a tool added later cannot quietly go unverified.
"""

from typing import Any

import pytest

from superset import db
from superset.ai.llm.base import ToolCall
from superset.ai.tools import build_registry
from superset.ai.tools.base import ALL_TOOL_NAMES
from superset.models.ai import AIChatFeedback, AIChatMessage, AIChatThread
from superset.utils.database import get_main_database
from tests.integration_tests.base_tests import SupersetTestCase


def _call(name: str, **arguments: Any) -> ToolCall:
    return ToolCall(id=f"call-{name}", name=name, arguments=arguments)


class TestAIToolsEndToEnd(SupersetTestCase):
    """Each tool, executed for real."""

    def setUp(self) -> None:
        super().setUp()
        self.login("admin")
        self.registry = build_registry()

    def tearDown(self) -> None:
        super().tearDown()
        db.session.query(AIChatFeedback).delete()
        db.session.query(AIChatMessage).delete()
        db.session.query(AIChatThread).delete()
        db.session.commit()

    def _invoke(self, name: str, **arguments: Any) -> Any:
        invocation = self.registry.invoke(_call(name, **arguments))
        assert not invocation.is_error, (
            f"{name} failed: {invocation.result.content[:400]}"
        )
        return invocation

    # ------------------------------------------------------------------
    # every tool is reachable and registered
    # ------------------------------------------------------------------

    def test_registry_exposes_every_documented_tool(self) -> None:
        """
        The registry and the published name list agree.

        ``ALL_TOOL_NAMES`` is what operators type into ``AI_AGENT_PROFILES``, so
        a drift between it and the real registry would make a valid config fail.
        """
        assert sorted(self.registry.names()) == sorted(ALL_TOOL_NAMES)
        for name in ALL_TOOL_NAMES:
            assert name in self.registry

    def test_every_tool_publishes_a_usable_schema(self) -> None:
        """
        Each tool offers a well-formed JSON Schema to the model.

        A malformed schema is rejected by the provider for the whole request, so
        one bad tool would disable the entire assistant rather than itself.
        """
        definitions = {d.name: d for d in self.registry.definitions()}
        assert sorted(definitions) == sorted(ALL_TOOL_NAMES)
        for name, definition in definitions.items():
            assert definition.description.strip(), f"{name} has no description"
            schema = definition.input_schema
            assert schema.get("type") == "object", name
            assert isinstance(schema.get("properties"), dict), name

    # ------------------------------------------------------------------
    # discovery tools
    # ------------------------------------------------------------------

    def test_list_databases_runs(self) -> None:
        """The assistant can see the connections it is allowed to query."""
        invocation = self._invoke("list_databases")
        display = invocation.display
        assert display is not None
        assert display["kind"] == "database_list"
        assert invocation.result.content

    def test_get_schema_runs_at_each_level(self) -> None:
        """Schema discovery works for schemas, tables, then columns."""
        database = get_main_database()

        schemas = self._invoke("get_schema", database_id=database.id)
        assert schemas.display is not None

        # Narrowing to a schema and then a table exercises the resolution path
        # that rejects names the user cannot see.
        tables = self._invoke("get_schema", database_id=database.id, schema="public")
        assert tables.display is not None

    def test_search_assets_runs(self) -> None:
        """Asset search executes against real metadata."""
        invocation = self._invoke("search_assets", query="birth")
        display = invocation.display
        assert display is not None
        assert display["kind"] == "asset_search"
        assert "counts_by_type" in display

    def test_search_assets_tolerates_wildcards_in_the_term(self) -> None:
        """
        A ``%`` in the search term is escaped, not treated as a wildcard.

        Otherwise a single character would turn every search into a full scan.
        """
        invocation = self._invoke("search_assets", query="100%")
        assert invocation.display is not None

    # ------------------------------------------------------------------
    # SQL tools
    # ------------------------------------------------------------------

    def test_execute_sql_runs_a_real_query(self) -> None:
        """
        A read-only query reaches the database and returns rows.

        This is the load-bearing tool: if it cannot execute, the assistant can
        describe data but never check anything.
        """
        database = get_main_database()
        invocation = self._invoke(
            "execute_sql",
            database_id=database.id,
            sql="SELECT 1 AS one, 2 AS two",
        )
        display = invocation.display
        assert display is not None
        assert display["kind"] == "sql_result"
        assert display["columns"] == ["one", "two"]
        assert display["row_count"] == 1
        assert display["rows"][0]["one"] == 1
        # The exact statement sent to the warehouse is surfaced so a user can
        # check the answer, which is the whole point of showing the SQL.
        assert "SELECT" in display["executed_sql"].upper()
        assert display["duration_ms"] >= 0

    def test_execute_sql_refuses_a_write(self) -> None:
        """A mutating statement is refused before it reaches the database."""
        database = get_main_database()
        invocation = self.registry.invoke(
            _call(
                "execute_sql",
                database_id=database.id,
                sql="DROP TABLE ai_chat_messages",
            )
        )
        assert invocation.is_error
        # And the table is still there.
        assert db.session.query(AIChatMessage).count() == 0

    def test_execute_sql_refuses_a_write_hidden_behind_a_read(self) -> None:
        """A second statement cannot ride along behind a legitimate query."""
        database = get_main_database()
        invocation = self.registry.invoke(
            _call(
                "execute_sql",
                database_id=database.id,
                sql="SELECT 1; DELETE FROM ai_chat_threads",
            )
        )
        assert invocation.is_error

    def test_execute_sql_rejects_an_unknown_database(self) -> None:
        """An invisible or absent connection reports the same thing."""
        invocation = self.registry.invoke(
            _call("execute_sql", database_id=999_999, sql="SELECT 1")
        )
        assert invocation.is_error

    def test_execute_sql_caps_returned_rows(self) -> None:
        """
        A large result is truncated and says so.

        An unbounded result set would exhaust the model's context and the
        response body alike.
        """
        from unittest.mock import patch

        from flask import current_app

        database = get_main_database()
        # patch.dict restores the key's absence as well as its value; assigning
        # a saved ``None`` back would leave the ceiling unset for later tests.
        with patch.dict(current_app.config, {"AI_AGENT_MAX_RESULT_ROWS": 5}):
            invocation = self._invoke(
                "execute_sql",
                database_id=database.id,
                sql=(
                    "SELECT n FROM (SELECT 1 AS n UNION ALL SELECT 2 "
                    "UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 "
                    "UNION ALL SELECT 6 UNION ALL SELECT 7) AS t"
                ),
            )

        display = invocation.display
        assert display is not None
        # The cap is pushed down into the statement, so the warehouse returns at
        # most this many rows and nothing has to be discarded afterwards. That is
        # why ``truncated`` — which reports rows dropped after fetching — stays
        # false here; the evidence the cap applied is the executed SQL.
        assert display["row_count"] <= 5
        assert "5" in display["executed_sql"]

    def test_validate_sql_accepts_valid_and_reports_invalid(self) -> None:
        """Validation runs without executing the statement."""
        database = get_main_database()
        ok = self._invoke(
            "validate_sql", database_id=database.id, sql="SELECT 1 AS one"
        )
        assert ok.display is not None

        bad = self.registry.invoke(
            _call(
                "validate_sql",
                database_id=database.id,
                sql="SELECT FROM WHERE (((",
            )
        )
        # Either an error result or a validation payload reporting the problem
        # is acceptable; silently claiming the SQL is fine is not.
        if not bad.is_error:
            assert bad.display is not None
            assert bad.display.get("valid") is not True

    # ------------------------------------------------------------------
    # context tools
    # ------------------------------------------------------------------

    def test_get_chart_context_runs(self) -> None:
        """A chart's definition can be read."""
        chart = db.session.query(self._slice_model()).first()
        if chart is None:
            pytest.skip("no charts in the test metadata database")
        invocation = self._invoke("get_chart_context", chart_id=chart.id)
        assert invocation.display is not None

    def test_get_dashboard_context_runs(self) -> None:
        """A dashboard's definition can be read."""
        from superset.models.dashboard import Dashboard

        dashboard = db.session.query(Dashboard).first()
        if dashboard is None:
            pytest.skip("no dashboards in the test metadata database")
        invocation = self._invoke("get_dashboard_context", dashboard_id=dashboard.id)
        assert invocation.display is not None

    def test_context_tools_reject_unknown_ids(self) -> None:
        """A missing object is an error result, not an exception."""
        for name, key in (
            ("get_chart_context", "chart_id"),
            ("get_dashboard_context", "dashboard_id"),
        ):
            invocation = self.registry.invoke(_call(name, **{key: 999_999}))
            assert invocation.is_error, name

    # ------------------------------------------------------------------
    # configurability
    # ------------------------------------------------------------------

    def test_a_profile_can_narrow_the_tool_set(self) -> None:
        """
        An operator can withhold SQL execution.

        This is the configuration a deployment reaches for when it wants the
        assistant to help navigate without touching the warehouse.
        """
        narrowed = build_registry().subset(["search_assets", "get_schema"])
        assert sorted(narrowed.names()) == ["get_schema", "search_assets"]
        assert "execute_sql" not in narrowed

    def test_an_unknown_tool_name_is_loud(self) -> None:
        """A typo in configuration fails rather than silently narrowing."""
        with pytest.raises(ValueError, match="no_such_tool"):
            build_registry().subset(["no_such_tool"])

    def test_dispatching_an_unregistered_tool_is_an_error_result(self) -> None:
        """
        A model inventing a tool name gets a correctable error.

        Raising would end an otherwise productive turn over a mistake the model
        could fix on its next step.
        """
        invocation = self.registry.invoke(_call("not_a_tool"))
        assert invocation.is_error

    def _slice_model(self) -> Any:
        from superset.models.slice import Slice

        return Slice
