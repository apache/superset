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
Guards applied to every tool call before it runs.

These bound blast radius. They are **not** an authorization layer: a tool that
returns or mutates a specific data-bearing object still has to perform its own
``security_manager.raise_for_access(...)`` check. A policy answers "should this
shape of call be attempted at all", which is a cheaper and coarser question.

Policies are configured as dotted paths in ``AI_AGENT_TOOL_POLICIES`` so a
deployment can add its own without forking.
"""

from __future__ import annotations

import logging
import re
from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

#: A bare identifier, or dotted parts thereof. Deliberately strict: anything
#: with whitespace, quotes, semicolons or parentheses is rejected rather than
#: escaped, because a tool that needs to escape an identifier is a tool that is
#: building SQL by concatenation.
_SAFE_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$")

#: Argument names understood to carry identifiers rather than free text.
_IDENTIFIER_ARGUMENTS = frozenset(
    {"table", "table_name", "schema", "schema_name", "catalog", "column", "columns"}
)


@dataclass(frozen=True)
class Denial:
    """
    A refusal to run a tool call.

    ``reason`` is shown to the model, so it should say what would be acceptable
    instead. A model that is told "only read-only SQL is allowed" rewrites its
    query; a model that is told "denied" retries the same thing.
    """

    reason: str


class ToolPolicy(ABC):
    """A pre-execution guard over a single tool call."""

    #: Identifies the policy in logs.
    name: str = "policy"

    @abstractmethod
    def check(
        self,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> Denial | None:
        """
        Inspect a pending call.

        Return ``None`` to allow, or a :class:`Denial` to block. A policy that
        does not apply to ``tool_name`` returns ``None``.
        """


class ReadOnlySqlPolicy(ToolPolicy):
    """
    Refuse anything that is not a read.

    Correctness here rests on Superset's own parser rather than a prefix or
    keyword match. A regex over the leading token is defeated by a leading
    comment, a CTE that wraps a DML statement, ``EXPLAIN ANALYZE DELETE``, and
    multi-statement scripts — all of which the parser handles because the rest
    of Superset already depends on it for the same decision.
    """

    name = "read_only_sql"

    #: Tools whose payload is SQL to execute.
    sql_tools = frozenset(
        {
            "execute_sql",
            "validate_sql",
            "run_scoped_sql",
            "create_virtual_dataset",
        }
    )

    #: Argument names that may carry the SQL.
    sql_arguments = ("sql", "query")

    #: Introspection commands permitted even when the parser cannot model them.
    #:
    #: Most dialects surface ``EXPLAIN`` and ``SHOW`` as an opaque catch-all
    #: node, so a blanket "refuse what we cannot parse" rule would also refuse
    #: the schema and query-plan inspection an analysis agent legitimately
    #: needs. Enumerating them keeps the default deny for everything else.
    read_only_commands = frozenset({"EXPLAIN", "SHOW", "DESCRIBE", "DESC"})

    def check(self, tool_name: str, arguments: dict[str, Any]) -> Denial | None:
        if tool_name not in self.sql_tools:
            return None

        sql = self._extract_sql(arguments)
        if sql is None:
            return Denial(
                f"{tool_name} requires a 'sql' argument containing the statement "
                f"to run."
            )
        if not sql.strip():
            return Denial("The 'sql' argument is empty.")

        engine = self._engine(arguments)

        try:
            from superset.sql.parse import SQLScript

            script = SQLScript(sql, engine=engine)
        except Exception:  # pylint: disable=broad-except
            # Unparseable SQL cannot be shown to be read-only, so it is
            # refused. Logged rather than surfaced: parser errors can quote
            # arbitrary query text back to the caller.
            logger.info("Refusing unparseable SQL from tool %s", tool_name)
            return Denial(
                "That SQL could not be parsed. Send a single, syntactically "
                "valid read-only statement."
            )

        # Checked per statement so a write cannot ride along behind a read.
        for statement in script.statements:
            if statement.is_mutating():
                return Denial(
                    "Only read-only SQL is allowed. Rewrite this as a SELECT — "
                    "statements that modify data or schema are refused."
                )

        # Anything the parser could not model is refused unless every statement
        # is recognisably an introspection command. The mutation check above has
        # already run, but it cannot reason about an opaque node on every
        # dialect, so this is the fail-closed half of the decision.
        if script.has_unparseable_statement and not all(
            self._is_read_only_command(statement) for statement in script.statements
        ):
            return Denial(
                "That SQL contains a statement this tool cannot verify as "
                "read-only. Send a plain SELECT."
            )
        return None

    def _engine(self, arguments: dict[str, Any]) -> str:
        """Resolve the parser dialect from the selected Superset database."""
        if engine := arguments.get("engine"):
            return str(engine)

        database_id = arguments.get("database_id")
        if not isinstance(database_id, int) or isinstance(database_id, bool):
            return ""

        try:
            from superset.daos.database import DatabaseDAO

            database = DatabaseDAO.find_by_id(database_id)
            if database is not None:
                return str(database.db_engine_spec.engine or "")
        except Exception:  # pylint: disable=broad-except
            logger.debug("Could not resolve SQL dialect for database %s", database_id)
        return ""

    def _is_read_only_command(self, statement: Any) -> bool:
        """Whether a statement is one of the permitted introspection commands."""
        try:
            text = statement.format(comments=False)
        except Exception:  # pylint: disable=broad-except
            # A statement that will not even render is not one we can vouch for.
            return False
        leading = text.strip().split(None, 1)
        if not leading:
            return False
        return leading[0].upper() in self.read_only_commands

    def _extract_sql(self, arguments: dict[str, Any]) -> str | None:
        """Pull the SQL payload out of whichever argument carries it."""
        for key in self.sql_arguments:
            value = arguments.get(key)
            if isinstance(value, str):
                return value
        return None


class IdentifierPolicy(ToolPolicy):
    """
    Refuse identifiers that are not plain names.

    Tools should resolve names against registered metadata rather than splice
    them into SQL. This policy is the backstop for the ones that take a name as
    an argument: rejecting anything unusual is safer than trying to quote it,
    because a value needing quoting signals string-built SQL underneath.
    """

    name = "identifier"

    def check(self, tool_name: str, arguments: dict[str, Any]) -> Denial | None:
        for key, value in arguments.items():
            if key not in _IDENTIFIER_ARGUMENTS:
                continue
            for candidate in self._as_identifiers(value):
                # A wildcard is a legitimate column selector.
                if candidate == "*":
                    continue
                if not _SAFE_IDENTIFIER.match(candidate):
                    return Denial(
                        f"{key!r} must be a plain identifier; {candidate!r} is "
                        f"not accepted."
                    )
        return None

    def _as_identifiers(self, value: Any) -> list[str]:
        """Normalise the several shapes an identifier argument arrives in."""
        if isinstance(value, str):
            # Comma-separated lists are common for column arguments.
            return [part.strip() for part in value.split(",") if part.strip()]
        if isinstance(value, (list, tuple)):
            return [str(item).strip() for item in value if str(item).strip()]
        return []


class ForeignToolPolicy(ToolPolicy):
    """
    Refuse SQL execution offered by an external MCP server.

    Superset's two SQL controls both act on statements Superset itself runs.
    :class:`ReadOnlySqlPolicy` parses the statement before execution and refuses
    anything that mutates; ``security_manager`` then authorizes the specific
    database, catalog, schema and table the statement touches. Neither can apply
    to SQL run by a third party: Superset never sees the statement, cannot know
    which datasource it reached, and holds no permission mapping for that
    server's data. Allowing a foreign tool to run SQL therefore does not widen
    the surface so much as remove the two controls that make ``execute_sql``
    safe, and it does so without any signal that it has happened.

    Only names that advertise query execution are refused. A foreign tool that
    searches a catalog, reads metadata or fetches a document is untouched, which
    is the whole point of the extension point.

    The matcher is deliberately broad, and configurable two ways. A deployment
    satisfied that its own servers enforce equivalent controls sets
    ``AI_AGENT_MCP_DENY_FOREIGN_SQL = False``. One that wants a different match
    subclasses and sets :attr:`sql_name_fragments`, or configures a subclass that
    passes ``fragments`` to :meth:`__init__`.

    Built-in tools are not this policy's business: they pass through untouched
    for :class:`ReadOnlySqlPolicy` to judge.
    """

    name = "foreign_tool"

    #: Matched case-insensitively as substrings of the remote tool's own name —
    #: the part after ``mcp__<server>__``. Substrings rather than exact names
    #: because a server is free to call the same capability ``sql_query``,
    #: ``runQuery`` or ``execute_sql_async``, and the failure that matters is the
    #: one where an unfamiliar spelling slips through.
    sql_name_fragments: tuple[str, ...] = ("execute_sql", "run_sql", "query")

    def __init__(self, fragments: Sequence[str] | None = None) -> None:
        source = self.sql_name_fragments if fragments is None else fragments
        self.fragments = tuple(fragment.lower() for fragment in source if fragment)

    def check(self, tool_name: str, arguments: dict[str, Any]) -> Denial | None:
        from superset.ai.mcp.config import split_foreign_tool_name

        parts = split_foreign_tool_name(tool_name)
        if parts is None:
            return None
        if not self._enabled():
            return None

        _, remote_name = parts
        haystack = remote_name.lower()
        if any(fragment in haystack for fragment in self.fragments):
            return Denial(
                "Running SQL through an external server is not allowed: "
                "Superset cannot apply its read-only check or its per-datasource "
                "authorization to a statement it does not execute. Use Superset's "
                "own execute_sql tool to query data, and that server's metadata "
                "or search tools for everything else."
            )
        return None

    def _enabled(self) -> bool:
        """
        Whether the denial is in force.

        Fails closed: outside an application context, or with the setting
        unreadable, the answer is yes. A guard that switched itself off when it
        could not find its configuration would be worse than no guard, because it
        would look present.
        """
        try:
            from flask import current_app

            return bool(current_app.config.get("AI_AGENT_MCP_DENY_FOREIGN_SQL", True))
        except Exception:  # pylint: disable=broad-except
            return True


class PolicyChain:
    """
    Applies policies in order and stops at the first denial.

    Order matters: put the cheap structural checks first so an obviously bad
    call is refused without parsing anything.
    """

    def __init__(self, policies: list[ToolPolicy]) -> None:
        self.policies = policies

    def check(self, tool_name: str, arguments: dict[str, Any]) -> Denial | None:
        """Return the first denial, or ``None`` if every policy allows."""
        for policy in self.policies:
            denial = policy.check(tool_name, arguments)
            if denial is not None:
                logger.info("Tool call %s denied by policy %s", tool_name, policy.name)
                return denial
        return None


def load_policy_chain(paths: list[str] | None = None) -> PolicyChain:
    """
    Build the configured chain.

    A path that cannot be imported is fatal rather than skipped: silently
    dropping a guard because of a typo would weaken the deployment without
    anyone noticing.
    """
    from flask import current_app

    from superset.utils.class_utils import load_class_from_name

    if paths is None:
        paths = current_app.config.get("AI_AGENT_TOOL_POLICIES", [])

    policies: list[ToolPolicy] = []
    for path in paths:
        policies.append(load_class_from_name(path)())
    return PolicyChain(policies)
