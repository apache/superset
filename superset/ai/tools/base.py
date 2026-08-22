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
The tool contract and the registry that dispatches to it.

A tool is a small, self-authorizing unit of work. "Self-authorizing" is the
important half: the registry does not check permissions on a tool's behalf, and
neither does the policy chain in :mod:`superset.ai.policy`, which answers the
coarser question of whether a *shape* of call should be attempted at all. Any
tool that returns or mutates a data-bearing object performs its own
``security_manager`` check, because that is the only place with enough context to
know which object is being touched.

A tool returns two things. :attr:`ToolOutput.content` is what the model reads.
:attr:`ToolOutput.display` is a summary for the UI, so a user can expand what the
assistant did and see the SQL it ran and the rows it got back. Both are
size-bounded here rather than in each tool: ``display`` is persisted on the
message and shipped to the browser, so an unbounded one would be a second way to
blow up a response.
"""

from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, ClassVar

from superset.ai.llm.base import ToolCall, ToolDefinition, ToolResult
from superset.mcp_service.utils.sanitization import (
    LLM_CONTEXT_CLOSE_DELIMITER,
    LLM_CONTEXT_ESCAPED_CLOSE_DELIMITER,
    LLM_CONTEXT_ESCAPED_OPEN_DELIMITER,
    LLM_CONTEXT_OPEN_DELIMITER,
)
from superset.utils import json

logger = logging.getLogger(__name__)

#: Keys added to a payload whose budget was exceeded. Phrased for the model: it
#: says what was lost and what to do differently, because a model told only
#: "truncated" reissues the identical call.
TRUNCATION_KEY = "_truncated"
TRUNCATION_NOTE_KEY = "_truncation_note"

#: Share of the response budget the UI summary may use. The model's copy is the
#: one that has to be complete enough to reason over; ``display`` only has to be
#: enough to render, and it is persisted, so it gets the smaller share.
_DISPLAY_BUDGET_FRACTION = 0.5

#: Fallback response budget for use outside an application context, matching the
#: shipped ``AI_AGENT_MAX_RESULT_BYTES`` default.
_DEFAULT_MAX_BYTES = 256 * 1024


class ToolError(Exception):
    """
    A failure that should be shown to the model rather than raised at the user.

    Tools raise this for conditions the model can act on — a database it may not
    read, a column that does not resolve, SQL that will not parse. The registry
    turns it into a :class:`~superset.ai.llm.base.ToolResult` with
    ``is_error=True`` so the turn continues and the model can correct itself.

    The message is model-visible, so it must never carry a driver exception, a
    connection string, or a stack trace.
    """


@dataclass(frozen=True)
class ToolOutput:
    """
    What a tool returns.

    Build one with :meth:`of` rather than by hand, so that ``content`` and
    ``payload`` cannot disagree.
    """

    #: Model-facing text. Becomes :attr:`ToolResult.content`.
    content: str

    #: JSON-serialisable summary for the UI, or ``None`` when there is nothing
    #: worth rendering. Must never carry credentials, a connection string, or a
    #: full result set.
    display: dict[str, Any] | None = None

    #: The structure ``content`` was serialised from. Retained so the registry
    #: can shrink an oversized result by dropping rows rather than cutting JSON
    #: mid-token. ``None`` when the tool supplied text directly.
    payload: Any = None

    @classmethod
    def of(
        cls,
        payload: Any,
        display: dict[str, Any] | None = None,
    ) -> ToolOutput:
        """Serialise ``payload`` as the model-facing content."""
        return cls(
            content=json.dumps(payload, default=str),
            display=display,
            payload=payload,
        )


@dataclass
class ToolInvocation:
    """
    One completed dispatch, with everything a caller might need.

    Exists because two consumers want different things from the same call: the
    provider needs a :class:`~superset.ai.llm.base.ToolResult`, while the event
    stream and message persistence want the UI summary and the timing.
    """

    call_id: str
    tool_name: str
    result: ToolResult
    display: dict[str, Any] | None = None
    duration_ms: int = 0
    truncated: bool = False
    arguments: dict[str, Any] = field(default_factory=dict)

    @property
    def is_error(self) -> bool:
        """Whether the call failed."""
        return self.result.is_error

    def to_tool_result(self) -> ToolResult:
        """The provider-neutral result to feed back to the model."""
        return self.result


class AITool(ABC):
    """
    One capability offered to the model.

    Subclasses set :attr:`name`, :attr:`description` and :attr:`input_schema`,
    and implement :meth:`run`. Everything else — size capping, error
    translation, timing — is the registry's job.
    """

    #: Stable identifier the model calls, and the key an operator types when
    #: configuring which tools an agent profile may use. Renaming one is a
    #: breaking change: it appears in stored conversation history and in
    #: deployment configuration.
    name: ClassVar[str] = ""

    #: Shown to the model verbatim. This is the tool's entire user manual, so it
    #: should say when to reach for the tool and what it returns, not merely
    #: what it is called.
    description: ClassVar[str] = ""

    #: JSON Schema for the arguments object. Providers translate it into
    #: whatever their API expects.
    input_schema: ClassVar[dict[str, Any]] = {"type": "object", "properties": {}}

    @abstractmethod
    def run(self, **kwargs: Any) -> ToolOutput:
        """
        Perform the work.

        Raise :class:`ToolError` for anything the model should see and be able
        to recover from. Any other exception is treated as a defect: it is
        logged with a traceback and reported to the model as a generic failure,
        so that an unexpected driver error cannot leak its message.
        """

    def definition(self) -> ToolDefinition:
        """Provider-neutral description of this tool."""
        return ToolDefinition(
            name=self.name,
            description=self.description,
            input_schema=self.input_schema,
        )


def truncate_payload(payload: Any, max_bytes: int) -> tuple[str, bool]:
    """
    Serialise ``payload`` and bound it to ``max_bytes``.

    Returns the JSON text and whether anything was dropped. Truncation is
    applied to the largest list in a mapping payload — result rows in practice —
    because halving a row count is comprehensible to the model whereas cutting a
    JSON string mid-token is not. When there is no list to shrink, the text is
    cut and the marker says so.
    """
    text = json.dumps(payload, default=str)
    if len(text.encode("utf-8")) <= max_bytes:
        return text, False

    if isinstance(payload, dict):
        list_keys = [
            key for key, value in payload.items() if isinstance(value, list) and value
        ]
        if list_keys:
            # Shrink the longest list first; it is the one carrying the bulk.
            key = max(list_keys, key=lambda item: len(payload[item]))
            rows = payload[key]
            kept = len(rows)
            # Halve until it fits, always leaving one element so the model can
            # still see the shape of what it asked for.
            while kept > 1:
                kept //= 2
                candidate = dict(payload)
                candidate[key] = rows[:kept]
                candidate[TRUNCATION_KEY] = True
                candidate[TRUNCATION_NOTE_KEY] = (
                    f"Returned {kept} of {len(rows)} {key} — the full result "
                    f"exceeded the {max_bytes} byte response budget. Narrow the "
                    f"request (fewer columns, a tighter filter, a smaller limit) "
                    f"to see the rest."
                )
                text = json.dumps(candidate, default=str)
                if len(text.encode("utf-8")) <= max_bytes:
                    return text, True

    # Nothing structural to shrink: cut the text and say so plainly.
    note = f'…[truncated to {max_bytes} bytes]"}}'
    keep = max(0, max_bytes - len(note.encode("utf-8")))
    return text.encode("utf-8")[:keep].decode("utf-8", "ignore") + note, True


def strip_prompt_framing(value: Any) -> Any:
    """
    Remove the model-facing untrusted-content framing from a value.

    ``superset.mcp_service`` wraps user-authored text in ``<UNTRUSTED-CONTENT>``
    delimiters so a model can tell data from instruction. That framing is
    meaningless to a person and appeared verbatim in the panel's tool log, so it
    is removed on the way to the browser — and only there. The model's copy keeps
    the delimiters, which is the whole point of them.

    Text that was escaped because the author had literally typed a delimiter is
    restored, since for a reader that literal text is the honest rendering.
    """
    if isinstance(value, str):
        return (
            value.replace(LLM_CONTEXT_OPEN_DELIMITER, "")
            .replace(LLM_CONTEXT_CLOSE_DELIMITER, "")
            .replace(LLM_CONTEXT_ESCAPED_OPEN_DELIMITER, LLM_CONTEXT_OPEN_DELIMITER)
            .replace(LLM_CONTEXT_ESCAPED_CLOSE_DELIMITER, LLM_CONTEXT_CLOSE_DELIMITER)
            .strip()
        )
    if isinstance(value, dict):
        return {
            strip_prompt_framing(key): strip_prompt_framing(nested)
            for key, nested in value.items()
        }
    if isinstance(value, list):
        return [strip_prompt_framing(item) for item in value]
    return value


def bound_display(
    display: dict[str, Any] | None,
    max_bytes: int,
) -> dict[str, Any] | None:
    """
    Bound the UI summary to ``max_bytes``.

    The summary is persisted on the message and sent to the browser, so it needs
    its own ceiling rather than riding on the model-facing budget. Reuses the
    row-dropping strategy so a sample stays a valid sample.
    """
    if display is None:
        return None
    # Stripped before bounding so the ceiling applies to what is actually sent,
    # and so a payload is not spent on framing that gets removed anyway.
    display = strip_prompt_framing(display)
    text, truncated = truncate_payload(display, max_bytes)
    if not truncated:
        return display
    try:
        bounded = json.loads(text)
    except Exception:  # pylint: disable=broad-except
        # The text form was cut mid-structure and will not parse. A summary is
        # a nicety, so drop it rather than shipping something unrenderable.
        logger.info("Dropping an oversized tool display payload")
        return {TRUNCATION_KEY: True, TRUNCATION_NOTE_KEY: "Summary was too large."}
    return bounded if isinstance(bounded, dict) else None


class ToolRegistry:
    """
    Holds tools by name, exports their definitions, and dispatches calls.

    Registration is explicit — a caller constructs the tools it wants and hands
    them over. There is no discovery, no entry points and no dynamic import: the
    set of capabilities a deployment exposes to a model should be readable in one
    place rather than assembled by import side effects.
    """

    def __init__(self, tools: list[AITool] | None = None) -> None:
        self._tools: dict[str, AITool] = {}
        for tool in tools or []:
            self.register(tool)

    def register(self, tool: AITool) -> None:
        """
        Add a tool.

        A duplicate name is an error rather than an overwrite: silently
        replacing a tool would change what the model can do depending on
        registration order.
        """
        if not tool.name:
            raise ValueError(f"{type(tool).__name__} has no name")
        if tool.name in self._tools:
            raise ValueError(f"Tool {tool.name!r} is already registered")
        self._tools[tool.name] = tool

    def __contains__(self, name: object) -> bool:
        return name in self._tools

    def __len__(self) -> int:
        return len(self._tools)

    def names(self) -> list[str]:
        """Registered tool names, in registration order."""
        return list(self._tools)

    def get(self, name: str) -> AITool | None:
        """The tool registered under ``name``, or ``None``."""
        return self._tools.get(name)

    def definitions(self) -> list[ToolDefinition]:
        """Every tool's definition, for the provider's tool list."""
        return [tool.definition() for tool in self._tools.values()]

    def subset(self, names: list[str] | tuple[str, ...] | set[str]) -> ToolRegistry:
        """
        A registry containing only the named tools.

        This is how a deployment restricts what one agent profile may do. An
        unknown name raises rather than being skipped: a typo in configuration
        that silently removed a capability would look like a model that had
        simply stopped using the tool, which is close to undebuggable.
        """
        requested = list(names)
        unknown = [name for name in requested if name not in self._tools]
        if unknown:
            raise ValueError(
                f"Unknown tool(s) {', '.join(sorted(unknown))}. "
                f"Available: {', '.join(sorted(self._tools))}."
            )
        # Registration order is preserved rather than the caller's, so two
        # profiles listing the same tools present them to the model identically.
        return ToolRegistry(
            [tool for name, tool in self._tools.items() if name in set(requested)]
        )

    def invoke(
        self,
        call: ToolCall,
        max_bytes: int | None = None,
    ) -> ToolInvocation:
        """
        Run one tool call and return it with its UI summary and timing.

        Never raises for a tool-level failure: an unknown name, a refused call
        and a crash all come back as ``is_error=True`` results so the model can
        react within the same turn. The alternative — propagating — ends the turn
        on a mistake the model could have corrected.
        """
        started = time.monotonic()

        def elapsed() -> int:
            return int((time.monotonic() - started) * 1000)

        def failure(message: str) -> ToolInvocation:
            return ToolInvocation(
                call_id=call.id,
                tool_name=call.name,
                result=ToolResult(call_id=call.id, content=message, is_error=True),
                duration_ms=elapsed(),
                arguments=dict(call.arguments),
            )

        tool = self._tools.get(call.name)
        if tool is None:
            available = ", ".join(sorted(self._tools)) or "none"
            return failure(
                f"No tool named {call.name!r}. Available tools: {available}."
            )

        # Every tool here reads a permissioned resource, so all of them need a
        # principal to check against. Gated once, here, rather than in each tool:
        # a tool that forgot would otherwise fall through to whatever the
        # security manager does with an absent user, which is not a decision
        # worth leaving to chance.
        if _current_user() is None:
            return failure(
                f"{call.name} requires an authenticated user and none is "
                f"available for this request."
            )

        if max_bytes is None:
            max_bytes = _configured_max_bytes()

        try:
            output = tool.run(**call.arguments)
        except ToolError as ex:
            return failure(str(ex))
        except TypeError as ex:
            # Almost always the model supplying arguments that do not match the
            # schema. Reported as-is because the message names the offending
            # parameter, which is what lets the model fix the call.
            logger.info("Tool %s called with bad arguments: %s", call.name, ex)
            return failure(
                f"{call.name} was called with arguments that do not match its "
                f"schema: {ex}"
            )
        except Exception:  # pylint: disable=broad-except
            # A defect, not a recoverable condition. The real cause goes to the
            # log; the model gets a message that cannot leak a driver error.
            logger.exception("Tool %s failed", call.name)
            return failure(
                f"{call.name} failed unexpectedly. Try a different approach."
            )

        if output.payload is not None:
            content, truncated = truncate_payload(output.payload, max_bytes)
        else:
            content, truncated = _bound_text(output.content, max_bytes)

        display = bound_display(
            output.display, int(max_bytes * _DISPLAY_BUDGET_FRACTION)
        )
        duration = elapsed()
        logger.info(
            "Tool %s completed in %dms (%d bytes%s)",
            call.name,
            duration,
            len(content),
            ", truncated" if truncated else "",
        )
        return ToolInvocation(
            call_id=call.id,
            tool_name=call.name,
            result=ToolResult(call_id=call.id, content=content),
            display=display,
            duration_ms=duration,
            truncated=truncated,
            arguments=dict(call.arguments),
        )

    def dispatch(
        self,
        call: ToolCall,
        max_bytes: int | None = None,
    ) -> ToolResult:
        """
        Run one tool call and return only the provider-neutral result.

        Convenience over :meth:`invoke` for callers that do not need the UI
        summary.
        """
        return self.invoke(call, max_bytes=max_bytes).result


def _current_user() -> Any:
    """
    The principal on whose behalf tools run, or ``None``.

    Reuses the MCP service's resolver so there is one definition of "who is
    calling" across both surfaces. In a Flask request handler this is the user
    Flask-AppBuilder's login machinery already put on ``g``, which is also what
    ``security_manager`` reads — so the tools inherit the correct principal
    rather than establishing their own.
    """
    from superset.mcp_service.utils.permissions_utils import get_current_user

    return get_current_user()


def _bound_text(text: str, max_bytes: int) -> tuple[str, bool]:
    """Cut a plain string to ``max_bytes``, leaving a marker."""
    encoded = text.encode("utf-8")
    if len(encoded) <= max_bytes:
        return text, False
    note = f"…[truncated to {max_bytes} bytes]"
    keep = max(0, max_bytes - len(note.encode("utf-8")))
    return encoded[:keep].decode("utf-8", "ignore") + note, True


def _configured_max_bytes() -> int:
    """
    Response byte budget, from configuration where one is available.

    Falls back to the shipped default outside an application context so a tool
    remains unit-testable without a Flask app.
    """
    try:
        from flask import current_app

        return int(current_app.config["AI_AGENT_MAX_RESULT_BYTES"])
    except Exception:  # pylint: disable=broad-except
        return _DEFAULT_MAX_BYTES


#: Every built-in tool name. The single source of truth for configuration
#: validation and documentation: an operator naming a tool in an agent profile's
#: allowlist is naming one of these.
ALL_TOOL_NAMES: tuple[str, ...] = (
    "search_assets",
    "list_databases",
    "get_schema",
    "execute_sql",
    "validate_sql",
    "get_chart_context",
    "get_dashboard_context",
)

#: Names in :data:`ALL_TOOL_NAMES` that do not run a warehouse query.
DISCOVERY_TOOL_NAMES: tuple[str, ...] = (
    "search_assets",
    "list_databases",
    "get_schema",
    "get_chart_context",
    "get_dashboard_context",
)


def _all_tools() -> list[AITool]:
    """
    Instantiate every built-in tool, in :data:`ALL_TOOL_NAMES` order.

    Imports are local because these modules reach into models, DAOs and the
    security manager, and this one is imported from configuration-time code.
    """
    from superset.ai.tools.context import GetChartContextTool, GetDashboardContextTool
    from superset.ai.tools.metadata import GetSchemaTool, ListDatabasesTool
    from superset.ai.tools.search import SearchAssetsTool
    from superset.ai.tools.sql import ExecuteSqlTool, ValidateSqlTool

    return [
        SearchAssetsTool(),
        ListDatabasesTool(),
        GetSchemaTool(),
        ExecuteSqlTool(),
        ValidateSqlTool(),
        GetChartContextTool(),
        GetDashboardContextTool(),
    ]


#: The full read-only surface. The default for an analysis agent.
BUNDLE_READ_ONLY = "read_only"
#: Metadata and context only; cannot execute SQL. Useful for a cheap routing or
#: classification pass that should not be able to reach a warehouse.
BUNDLE_DISCOVERY = "discovery"

#: Bundle name → the tool names it contains. Bundles are named sets a runtime can
#: ask for instead of enumerating tools, and every member is in
#: :data:`ALL_TOOL_NAMES`.
BUNDLES: dict[str, tuple[str, ...]] = {
    BUNDLE_READ_ONLY: ALL_TOOL_NAMES,
    BUNDLE_DISCOVERY: DISCOVERY_TOOL_NAMES,
}


def bundle_names() -> list[str]:
    """Names accepted by :func:`build_registry`."""
    return sorted(BUNDLES)


def build_registry(
    bundle: str = BUNDLE_READ_ONLY,
    allowed: list[str] | tuple[str, ...] | set[str] | None = None,
) -> ToolRegistry:
    """
    Construct the registry for a named bundle.

    ``allowed`` further narrows the bundle to a deployment-configured allowlist.
    An unknown bundle or an unknown tool name is an error rather than an empty
    registry, because a typo that silently removed every tool would look like a
    model that had stopped using them.
    """
    try:
        members = BUNDLES[bundle]
    except KeyError:
        raise ValueError(
            f"Unknown tool bundle {bundle!r}. Available: {', '.join(bundle_names())}"
        ) from None

    members_set = set(members)
    registry = ToolRegistry([tool for tool in _all_tools() if tool.name in members_set])
    if allowed is None:
        return registry
    return registry.subset(allowed)
