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

"""Static scan: MCP code must not format exceptions into client output.

Every ``except ... as exc`` handler in ``superset/mcp_service``, and every
function that takes an exception argument, is scanned. Any expression that
turns the exception into text (``str(exc)``, ``repr(exc)``, ``f"{exc}"``,
``"%s" % exc``, ``exc.args``, ``exc.message``, ``exc.normalized_messages()``,
``bounded_exception_message(exc)`` and similar) is a finding, unless it is
passed only to a server-side logger, used in a ``raise`` or a comparison, or
the handler is listed in ``HOST_MESSAGE_HANDLERS``.

Failures go through ``superset.mcp_service.utils.tool_errors`` instead, whose
``safe_error`` applies the HTTP API's rule: Superset's own message for a
signed-in user, the generic message for an embedded guest, and a fixed message
for exceptions Superset did not raise. The exception itself is logged.

``HOST_MESSAGE_HANDLERS`` lists handlers whose exception text Superset writes
for the caller, such as request validation messages, and which carries no
warehouse data. Database, driver, provider and warehouse exceptions must never
be listed there.
"""

from __future__ import annotations

import ast
import builtins
import importlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest

MCP_ROOT = Path(__file__).resolve().parents[3] / "superset" / "mcp_service"

# Attributes that carry an exception's text.
TEXT_ATTRIBUTES = frozenset(
    {
        "args",
        "detail",
        "description",
        "error",
        "errors",
        "message",
        "messages",
        "msg",
        "normalized_messages",
        "orig",
    }
)

# Functions that return (a sanitized or bounded form of) an exception's text.
TEXT_FUNCTIONS = frozenset(
    {
        "str",
        "repr",
        "format",
        "bounded_exception_message",
        "_safe_exception_message",
        "_sanitize_validation_error",
        "sanitize_error_message",
        "sanitize_for_log",
    }
)

# Server-side sinks: a call on one of these receivers only writes a log.
LOGGER_NAMES = frozenset({"logger", "logging", "log", "_logger", "stderr"})
LOGGER_METHODS = frozenset({"_log_warning", "_log_error", "_log_info"})

# Helpers that take the exception object and never return its text.
SANITIZING_HELPERS = frozenset(
    {
        "internal_error_response",
        "log_tool_exception",
        "public_query_error",
        "report_tool_error",
        "safe_error",
        "tool_error_message",
    }
)

# Modules that build no tool response or ctx notification from a caught
# exception, with the reason.
SERVER_SIDE_MODULES: dict[str, str] = {
    "jwt_verifier.py": (
        "token verification reads the JOSE error code to choose a fixed "
        "failure reason; exception text only goes to the server log"
    ),
    "utils/tool_errors.py": (
        "the helpers themselves: client text comes only from safe_error and "
        "public_query_error; "
        "covered by utils/test_tool_errors.py"
    ),
    "middleware.py": (
        "last-resort handler: client text goes through "
        "_sanitize_error_for_logging and is covered by test_middleware.py"
    ),
}

# (path relative to superset/mcp_service, enclosing function, caught types)
# -> why the exception text is a host-owned message for the caller.
HOST_MESSAGE_HANDLERS: dict[tuple[str, str, str], str] = {
    ("dataset/tool/query_dataset.py", "_query_dataset", "ValueError"): (
        "text is returned only for a ValueError raised in "
        "superset.utils.date_parser, which describes the caller's time_range; "
        "any other ValueError gets the fixed message"
    ),
    (
        "chart/validation/dataset_validator.py",
        "_build_ambiguous_reference_error",
        "parameter AmbiguousDatasetReferenceError",
    ): "names the caller's ambiguous column reference and its dataset matches",
    (
        "chart/validation/schema_validator.py",
        "_enhance_validation_error",
        "parameter PydanticValidationError",
    ): "pydantic validation messages for the caller's chart config",
    (
        "dataset/tool/create_dataset.py",
        "_classify_invalid_error",
        "parameter DatasetInvalidError",
    ): "CreateDatasetCommand validation messages about the caller's input",
    ("utils/schema_utils.py", "__init__", "parameter Exception"): (
        "JSONParseError message: JSON parser position text about the caller's "
        "own argument string"
    ),
    ("utils/validation.py", "validation_message", "parameter Exception"): (
        "renders only field locations and fixed reasons from pydantic errors "
        "of the caller's arguments"
    ),
    (
        "chart/chart_utils.py",
        "validate_gantt_form_data",
        "ValidationError",
    ): "pydantic validation messages for the merged Gantt config",
    (
        "chart/plugins/bullet.py",
        "_render_model_error",
        "BulletOutputError",
    ): (
        "MCP exception raised by the Bullet resolvers with host text and a "
        "fixed error_type"
    ),
    (
        "chart/plugins/bullet.py",
        "ascii_preview",
        "BulletOutputError",
    ): (
        "MCP exception raised by the Bullet resolvers with host text and a "
        "fixed error_type"
    ),
    (
        "chart/plugins/bullet.py",
        "post_map_validate",
        "ValueError",
    ): "in-memory dataset column resolution naming the caller's column",
    (
        "chart/plugins/bullet.py",
        "sanitize_data_rows",
        "BulletOutputError",
    ): (
        "MCP exception raised by the Bullet resolvers with host text and a "
        "fixed error_type"
    ),
    (
        "chart/plugins/bullet.py",
        "vega_lite_preview",
        "BulletOutputError",
    ): (
        "MCP exception raised by the Bullet resolvers with host text and a "
        "fixed error_type"
    ),
    (
        "chart/plugins/gantt.py",
        "normalize_column_refs",
        "ValidationError",
    ): "pydantic validation messages for the host-built Gantt config",
    (
        "chart/plugins/geographic.py",
        "normalize_query_result",
        "ValueError",
    ): (
        "host validators over in-memory result rows; TypeError and KeyError are"
        " handled separately"
    ),
    (
        "chart/preview_utils.py",
        "_prepare_gauge_preview",
        "ValueError",
    ): "Gauge control validation messages written by the MCP",
    (
        "chart/tool/delete_chart.py",
        "delete_chart",
        "ChartDeleteFailedReportsExistError",
    ): "DeleteChartCommand text naming the alerts or reports that block the delete",
    (
        "chart/tool/get_chart_info.py",
        "_attach_dashboard_filters",
        "ChartNotOnDashboardError",
    ): "MCP exception naming the chart and dashboard ids",
    (
        "chart/tool/get_chart_info.py",
        "_attach_dashboard_filters",
        "DashboardNotFoundError",
    ): "fixed not-found text for the requested dashboard id",
    (
        "chart/tool/get_chart_info.py",
        "_attach_dashboard_filters",
        "SupersetSecurityException",
    ): "access-denied text from security_manager.raise_for_access",
    (
        "chart/tool/update_chart.py",
        "_validate_update_against_dataset",
        "GanttSemanticNormalizationError",
    ): "Gantt column-role validation text written by the MCP",
    (
        "chart/tool/update_chart.py",
        "_validate_update_against_dataset",
        "ValueError",
    ): "wraps only the chart plugin's validate_merged_form_data",
    (
        "chart/tool/update_chart.py",
        "_validate_update_against_semantic_view",
        "ValueError",
    ): "wraps only the chart plugin's validate_merged_form_data",
    (
        "chart/tool/update_chart.py",
        "update_chart",
        "GanttSemanticNormalizationError",
    ): "Gantt column-role validation text written by the MCP",
    (
        "chart/tool/update_chart.py",
        "update_chart",
        "ValueError",
    ): "wraps only the chart plugin's resolve_update_config",
    (
        "chart/tool/update_chart_preview.py",
        "update_chart_preview",
        "GanttSemanticNormalizationError",
    ): "Gantt column-role validation text written by the MCP",
    (
        "chart/tool/update_chart_preview.py",
        "update_chart_preview",
        "ValueError",
    ): (
        "wraps only the chart plugin's resolve_update_config and "
        "validate_merged_form_data"
    ),
    (
        "chart/validation/pipeline.py",
        "validate_request_with_warnings",
        "GanttSemanticNormalizationError",
    ): "Gantt column-role validation text written by the MCP",
    (
        "chart/validation/pipeline.py",
        "validate_request_with_warnings",
        "ValueError",
    ): (
        "column canonicalization raises only AmbiguousDatasetReferenceError "
        "with host text"
    ),
    (
        "dashboard/tool/apply_dashboard_filters.py",
        "apply_dashboard_filters",
        "_FilterApplyError",
    ): (
        "tool-internal exception raised with text built from the request and "
        "the dashboard's filter config"
    ),
    (
        "dashboard/tool/delete_dashboard.py",
        "delete_dashboard",
        "DashboardDeleteFailedReportsExistError",
    ): "DeleteDashboardCommand text naming the alerts or reports that block the delete",
    (
        "dashboard/tool/manage_dashboard_markdown.py",
        "manage_dashboard_markdown",
        "_ComponentOperationError",
    ): (
        "tool-internal exception raised with text built from component ids and "
        "tab names"
    ),
    (
        "dashboard/tool/manage_native_filters.py",
        "manage_native_filters",
        "DashboardInvalidError",
    ): "UpdateDashboardCommand validation messages written by Superset",
    (
        "dashboard/tool/manage_native_filters.py",
        "manage_native_filters",
        "TagForbiddenError",
    ): "validate_tags permission text",
    (
        "dashboard/tool/manage_native_filters.py",
        "manage_native_filters",
        "_FilterValidationError",
    ): "tool-internal exception raised with text built from filter fields and types",
    (
        "dashboard/tool/update_dashboard.py",
        "_validate_update_request",
        "MarshmallowValidationError",
    ): "validate_css text for the caller's CSS",
    (
        "dashboard/tool/update_dashboard.py",
        "_validate_update_request",
        "TagForbiddenError",
    ): "validate_tags permission text",
    (
        "dashboard/tool/update_dashboard.py",
        "_validate_update_request",
        "TagNotFoundValidationError",
    ): "validate_tags text naming the missing tag id",
    (
        "dashboard/tool/update_dashboard.py",
        "_validate_update_request",
        "ValueError",
    ): "the tool's own metadata clash check",
    (
        "dataset/tool/create_dataset.py",
        "create_dataset",
        "DatasetSoftDeletedTwinExistsError",
    ): "CreateDatasetCommand restore-or-rename text with the soft-deleted twin's uuid",
    (
        "dataset/tool/create_dataset_column.py",
        "create_dataset_column",
        "DatasetInvalidError",
    ): "UpdateDatasetCommand validation messages about the caller's update",
    (
        "dataset/tool/create_dataset_column.py",
        "create_dataset_column",
        "DatasetSoftDeletedTwinExistsError",
    ): "UpdateDatasetCommand restore-or-rename text with the soft-deleted twin's uuid",
    (
        "dataset/tool/create_dataset_metric.py",
        "create_dataset_metric",
        "DatasetInvalidError",
    ): "UpdateDatasetCommand validation messages about the caller's update",
    (
        "dataset/tool/create_dataset_metric.py",
        "create_dataset_metric",
        "DatasetSoftDeletedTwinExistsError",
    ): "UpdateDatasetCommand restore-or-rename text with the soft-deleted twin's uuid",
    (
        "dataset/tool/create_virtual_dataset.py",
        "create_virtual_dataset",
        "DatasetInvalidError",
    ): "create/update dataset command validation messages about the caller's input",
    (
        "dataset/tool/create_virtual_dataset.py",
        "create_virtual_dataset",
        "DatasetSoftDeletedTwinExistsError",
    ): "CreateDatasetCommand restore-or-rename text with the soft-deleted twin's uuid",
    (
        "dataset/tool/delete_dataset_metric.py",
        "delete_dataset_metric",
        "DatasetInvalidError",
    ): "UpdateDatasetCommand validation messages about the caller's update",
    (
        "dataset/tool/delete_dataset_metric.py",
        "delete_dataset_metric",
        "DatasetSoftDeletedTwinExistsError",
    ): "UpdateDatasetCommand restore-or-rename text with the soft-deleted twin's uuid",
    (
        "dataset/tool/update_dataset.py",
        "update_dataset",
        "DatasetInvalidError",
    ): "UpdateDatasetCommand validation messages about the caller's update",
    (
        "dataset/tool/update_dataset_column.py",
        "update_dataset_column",
        "DatasetInvalidError",
    ): "UpdateDatasetCommand validation messages about the caller's update",
    (
        "dataset/tool/update_dataset_column.py",
        "update_dataset_column",
        "DatasetSoftDeletedTwinExistsError",
    ): "UpdateDatasetCommand restore-or-rename text with the soft-deleted twin's uuid",
    (
        "dataset/tool/update_dataset_metric.py",
        "update_dataset_metric",
        "DatasetInvalidError",
    ): "UpdateDatasetCommand validation messages about the caller's update",
    (
        "dataset/tool/update_dataset_metric.py",
        "update_dataset_metric",
        "DatasetSoftDeletedTwinExistsError",
    ): "UpdateDatasetCommand restore-or-rename text with the soft-deleted twin's uuid",
    (
        "semantic_layer/tool/get_compatible_dimensions.py",
        "_resolve_compatible_dimensions",
        "AmbiguousDimensionError",
    ): "resolve_dimensions ambiguity text naming the caller's dimensions",
    (
        "semantic_layer/tool/get_compatible_dimensions.py",
        "_resolve_compatible_dimensions",
        "SupersetSecurityException",
    ): "access-denied text from SemanticView.raise_for_access",
    (
        "semantic_layer/tool/get_compatible_metrics.py",
        "_resolve_compatible_metrics",
        "AmbiguousDimensionError",
    ): "resolve_dimensions ambiguity text naming the caller's dimensions",
    (
        "semantic_layer/tool/get_compatible_metrics.py",
        "_resolve_compatible_metrics",
        "SupersetSecurityException",
    ): "access-denied text from SemanticView.raise_for_access",
    (
        "semantic_layer/tool/list_metrics.py",
        "_collect_external_metrics",
        "AmbiguousDimensionError",
    ): "resolve_dimensions ambiguity text naming the caller's dimensions",
    (
        "semantic_layer/tool/list_metrics.py",
        "list_metrics",
        "SupersetSecurityException",
    ): "access-denied text from SemanticView.raise_for_access",
    (
        "sql_lab/tool/execute_sql.py",
        "execute_sql",
        "SupersetSecurityException",
    ): "access-denied text from security_manager.raise_for_access",
    (
        "theme/tool/create_theme.py",
        "create_theme",
        "(TypeError, json.JSONDecodeError)",
    ): "json.loads position text about the caller's own json_data",
    (
        "theme/tool/create_theme.py",
        "create_theme",
        "ThemeInvalidError",
    ): "CreateThemeCommand validation messages about the caller's input",
    (
        "theme/tool/create_theme.py",
        "create_theme",
        "ValidationError",
    ): "theme schema validation messages about the caller's config",
    (
        "utils/schema_utils.py",
        "field_validation_error",
        "ValueError",
    ): (
        "wraps pydantic validators of caller input; the formatter in "
        "utils/validation.py renders fixed reasons"
    ),
    (
        "utils/validation.py",
        "_chart_config_union_marker",
        "ValidationError",
    ): "validates a constant diagnostic input and returns only a union location label",
}


# Handlers converted to the tool_errors helpers in a separate change. The
# stale-entry test does not report these, so either change can land first;
# remove an entry once its handler is converted.
PENDING_HANDLERS: dict[tuple[str, str, str], str] = {
    key: "get_table moves to public_query_error in its own change"
    for key in (
        (
            "semantic_layer/tool/get_table.py",
            "_resolve_external_view",
            "SupersetSecurityException",
        ),
        ("semantic_layer/tool/get_table.py", "_resolve_external_view", "ValueError"),
        ("semantic_layer/tool/get_table.py", "_get_table", "OAuth2Error"),
        (
            "semantic_layer/tool/get_table.py",
            "_get_table",
            "(CommandException, SupersetException)",
        ),
        ("semantic_layer/tool/get_table.py", "_get_table", "SQLAlchemyError"),
    )
}


@dataclass(frozen=True)
class Finding:
    path: str
    line: int
    function: str
    caught: str
    source: str

    @property
    def key(self) -> tuple[str, str, str]:
        return (self.path, self.function, self.caught)

    def __str__(self) -> str:
        return (
            f"{self.path}:{self.line} in {self.function} "
            f"(except {self.caught}): {self.source}"
        )


def _is_exception_ref(node: ast.AST, names: set[str]) -> bool:
    """Whether ``node`` is the exception or a text attribute chain on it."""
    if isinstance(node, ast.Name):
        return node.id in names
    if isinstance(node, ast.Call):
        return _is_exception_ref(node.func, names)
    if isinstance(node, ast.Subscript):
        return _is_exception_ref(node.value, names)
    if isinstance(node, ast.Attribute):
        if node.attr in TEXT_ATTRIBUTES:
            return _is_exception_ref(node.value, names)
        if node.attr == "__name__":
            # type(exc).__name__
            inner = node.value
            return (
                isinstance(inner, ast.Call)
                and isinstance(inner.func, ast.Name)
                and inner.func.id == "type"
                and bool(inner.args)
                and _is_exception_ref(inner.args[0], names)
            )
    return False


def _mentions_exception(node: ast.AST, names: set[str]) -> bool:
    return any(_is_exception_ref(child, names) for child in ast.walk(node))


def _call_name(node: ast.Call) -> str | None:
    if isinstance(node.func, ast.Name):
        return node.func.id
    if isinstance(node.func, ast.Attribute):
        return node.func.attr
    return None


def _is_server_side_call(node: ast.Call) -> bool:
    func = node.func
    if isinstance(func, ast.Attribute):
        if func.attr in LOGGER_METHODS:
            return True
        receiver = func.value
        if isinstance(receiver, ast.Name) and receiver.id in LOGGER_NAMES:
            return True
        if isinstance(receiver, ast.Attribute) and receiver.attr in LOGGER_NAMES:
            return True
    return _call_name(node) in SANITIZING_HELPERS | {"isinstance"}


def _is_text_call(node: ast.Call, names: set[str]) -> bool:
    """Whether a call renders the exception as text."""
    name = _call_name(node)
    if name in TEXT_FUNCTIONS or (
        name == "format" and isinstance(node.func, ast.Attribute)
    ):
        return any(_mentions_exception(arg, names) for arg in node.args)
    return (
        name == "getattr"
        and len(node.args) >= 2
        and _mentions_exception(node.args[0], names)
        and isinstance(node.args[1], ast.Constant)
        and node.args[1].value in TEXT_ATTRIBUTES
    )


def _is_leak(node: ast.AST, names: set[str]) -> bool:
    """Whether ``node`` itself renders the exception as text."""
    if isinstance(node, ast.Call) and _is_text_call(node, names):
        return True
    if isinstance(node, ast.FormattedValue):
        return _mentions_exception(node.value, names)
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mod):
        return _mentions_exception(node.right, names)
    # exc.message, exc.normalized_messages(), type(exc).__name__ ...
    return isinstance(node, (ast.Attribute, ast.Call)) and _is_exception_ref(
        node, names
    )


def _is_pruned(node: ast.AST) -> bool:
    """Whether nothing under ``node`` can reach a client."""
    if isinstance(
        node,
        (ast.Raise, ast.Compare, ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda),
    ):
        return True
    if isinstance(node, ast.Call):
        return _is_server_side_call(node)
    # A structured field such as exc.query_id or exc.error.error_type.
    return (
        isinstance(node, ast.Attribute)
        and node.attr not in TEXT_ATTRIBUTES
        and isinstance(node.value, (ast.Name, ast.Attribute))
    )


def _text_leaks(node: ast.AST, names: set[str]) -> list[ast.AST]:
    """Expressions under ``node`` that render the exception as text."""
    if isinstance(node, ast.Call) and _is_server_side_call(node):
        return []
    if _is_leak(node, names):
        return [node]
    if _is_pruned(node):
        return []
    return [
        leak
        for child in ast.iter_child_nodes(node)
        for leak in _text_leaks(child, names)
    ]


def _enclosing_functions(tree: ast.AST) -> dict[int, str]:
    """Map each handler node id to the name of its enclosing function."""
    owners: dict[int, str] = {}

    def visit(node: ast.AST, owner: str) -> None:
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                visit(child, child.name)
            else:
                if isinstance(child, ast.ExceptHandler):
                    owners[id(child)] = owner
                visit(child, owner)

    visit(tree, "<module>")
    return owners


def _is_exception_class(node: ast.AST, namespace: dict[str, Any]) -> bool:
    """Whether every member of an annotation such as ``A | B`` is an exception."""
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.BitOr):
        return _is_exception_class(node.left, namespace) and _is_exception_class(
            node.right, namespace
        )
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        try:
            return _is_exception_class(
                ast.parse(node.value, mode="eval").body, namespace
            )
        except SyntaxError:
            return False
    if isinstance(node, ast.Name):
        value = namespace.get(node.id, getattr(builtins, node.id, None))
        return isinstance(value, type) and issubclass(value, BaseException)
    return False


def _exception_parameters(
    function: ast.FunctionDef | ast.AsyncFunctionDef, namespace: dict[str, Any]
) -> dict[str, str]:
    arguments = function.args
    return {
        argument.arg: ast.unparse(argument.annotation)
        for argument in (
            *arguments.posonlyargs,
            *arguments.args,
            *arguments.kwonlyargs,
        )
        if argument.annotation is not None
        and _is_exception_class(argument.annotation, namespace)
    }


def scan_source(
    source: str, path: str, namespace: dict[str, Any] | None = None
) -> list[Finding]:
    """Scan ``except`` handlers, and functions that take an exception argument.

    ``namespace`` resolves parameter annotations; without it only builtin
    exception classes are recognized.
    """
    tree = ast.parse(source)
    owners = _enclosing_functions(tree)
    namespace = namespace or {}
    findings: list[Finding] = []

    def collect(
        body: list[ast.stmt], names: set[str], function: str, caught: str
    ) -> None:
        seen: set[int] = set()
        for statement in body:
            for leak in _text_leaks(statement, names):
                line: int = getattr(leak, "lineno", 0)
                if line in seen:
                    continue
                seen.add(line)
                findings.append(
                    Finding(
                        path=path,
                        line=line,
                        function=function,
                        caught=caught,
                        source=ast.unparse(leak),
                    )
                )

    for node in ast.walk(tree):
        if isinstance(node, ast.ExceptHandler) and node.name:
            caught = ast.unparse(node.type) if node.type else "BaseException"
            collect(node.body, {node.name}, owners.get(id(node), "<module>"), caught)
        elif (
            isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
            and node.name not in TEXT_FUNCTIONS
        ):
            for name, annotation in _exception_parameters(node, namespace).items():
                collect(node.body, {name}, node.name, f"parameter {annotation}")
    return findings


def scan_mcp_service() -> list[Finding]:
    findings: list[Finding] = []
    for module in sorted(MCP_ROOT.rglob("*.py")):
        relative = module.relative_to(MCP_ROOT).as_posix()
        if relative in SERVER_SIDE_MODULES:
            continue
        dotted = "superset.mcp_service." + relative.removesuffix(".py").replace(
            "/", "."
        ).removesuffix(".__init__")
        try:
            namespace = vars(importlib.import_module(dotted))
        except Exception:  # noqa: BLE001 - modules with optional dependencies
            namespace = {}
        findings.extend(
            scan_source(module.read_text(encoding="utf-8"), relative, namespace)
        )
    return findings


def test_mcp_service_sends_no_exception_text_to_clients() -> None:
    unexpected = [
        str(finding)
        for finding in scan_mcp_service()
        if finding.key not in HOST_MESSAGE_HANDLERS
        and finding.key not in PENDING_HANDLERS
    ]
    assert not unexpected, (
        "Exception text reaches an MCP client (tool response or ctx log "
        "notification). Use internal_error_response/report_tool_error from "
        "superset.mcp_service.utils.tool_errors:\n" + "\n".join(unexpected)
    )


def test_host_message_allowlist_has_no_stale_entries() -> None:
    used = {finding.key for finding in scan_mcp_service()}
    stale = sorted(set(HOST_MESSAGE_HANDLERS) - used)
    assert not stale, f"Remove stale allowlist entries: {stale}"


_HANDLER_TEMPLATE = (
    "async def tool(ctx):\n"
    "    try:\n"
    "        pass\n"
    "    except Exception as e:\n"
    "        {body}\n"
)


@pytest.mark.parametrize(
    "body",
    [
        'await ctx.error("Failed: %s" % (str(e),))',
        'await ctx.warning(f"Failed: {e}")',
        'await ctx.error("Failed: %s: %s" % (type(e).__name__, e))',
        'return Error(error=f"Failed to get info: {str(e)}")',
        "return Error(error=str(e))",
        "return Error(error=e.message)",
        "return Error(error=str(e.normalized_messages()))",
        "return Error(error=bounded_exception_message(e))",
        'return {"error": "Failed: {}".format(e)}',
        "text = str(e)\n        return Error(error=text)",
    ],
)
def test_scanner_flags_exception_text(body: str) -> None:
    source = _HANDLER_TEMPLATE.format(body=body)
    assert scan_source(source, "example.py"), body


@pytest.mark.parametrize(
    "body",
    [
        'logger.error("Failed: %s", e)',
        'logger.exception("Failed: %s" % (str(e),))',
        'await report_tool_error(ctx, "Failed to get info", e, identifier=1)',
        'return internal_error_response(Error, "Failed to get info", e)',
        'raise ToolError(f"Failed: {e}") from e',
        'if "application context" in str(e):\n            pass',
        "if isinstance(e, KeyError):\n            pass",
        'await ctx.error("Failed to get info")',
    ],
)
def test_scanner_allows_server_side_use(body: str) -> None:
    source = _HANDLER_TEMPLATE.format(body=body)
    assert not scan_source(source, "example.py"), body


def test_scanner_checks_functions_that_take_an_exception() -> None:
    source = (
        "def to_error(exc: ValueError):\n"
        "    return Error(error=str(exc))\n"
        "def to_code(exc: ValueError):\n"
        "    return 'DatabaseError' if isinstance(exc, KeyError) else 'Other'\n"
    )
    findings = scan_source(source, "example.py")
    assert [finding.function for finding in findings] == ["to_error"]
    assert findings[0].caught == "parameter ValueError"
