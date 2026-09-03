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
"""Native AI adapters for Superset's existing MCP authoring tools."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from importlib import import_module
from threading import Thread
from typing import Any, ClassVar, TypeVar

from pydantic import BaseModel, ValidationError

from superset.ai.tools.base import AITool, ToolError, ToolOutput
from superset.mcp_service.chart.schemas import GenerateChartRequest
from superset.mcp_service.dashboard.schemas import GenerateDashboardRequest
from superset.mcp_service.dataset.schemas import CreateVirtualDatasetRequest
from superset.utils import json

ModelT = TypeVar("ModelT", bound=BaseModel)
ToolCaller = Callable[[BaseModel], Any]

_MCP_TOOL_MODULES = {
    "create_virtual_dataset": (
        "superset.mcp_service.dataset.tool.create_virtual_dataset"
    ),
    "generate_chart": "superset.mcp_service.chart.tool.generate_chart",
    "generate_dashboard": ("superset.mcp_service.dashboard.tool.generate_dashboard"),
}


def _tool_schema(model: type[BaseModel]) -> dict[str, Any]:
    """Expose a request model without its server-only warning field."""
    schema = model.model_json_schema()
    properties = dict(schema.get("properties", {}))
    properties.pop("sanitization_warnings", None)
    schema["properties"] = properties
    if required := schema.get("required"):
        schema["required"] = [
            name for name in required if name != "sanitization_warnings"
        ]
    return schema


def _validate(model: type[ModelT], payload: dict[str, Any], label: str) -> ModelT:
    """Turn Pydantic errors into a correction the model can act on."""
    try:
        return model.model_validate(payload)
    except ValidationError as ex:
        issues = []
        for error in ex.errors(include_url=False)[:3]:
            location = ".".join(str(part) for part in error["loc"])
            issues.append(f"{location}: {error['msg']}")
        raise ToolError(f"Invalid {label} request: {'; '.join(issues)}.") from ex


def _payload(response: Any) -> dict[str, Any]:
    if isinstance(response, BaseModel):
        return response.model_dump(mode="json", exclude_none=True)
    if isinstance(response, dict):
        return response
    raise ToolError("Superset returned an unexpected authoring response.")


async def _call_mcp_tool(tool_name: str, request: BaseModel) -> Any:
    """Call the registered tool through FastMCP so it gets a real context."""
    import_module(_MCP_TOOL_MODULES[tool_name])

    from fastmcp import Client

    from superset.mcp_service.app import mcp

    arguments = {
        "request": request.model_dump(
            mode="json",
            exclude={"sanitization_warnings"},
            exclude_none=True,
        )
    }
    async with Client(mcp) as client:
        result = await client.call_tool(tool_name, arguments)

    if result.is_error:
        raise ToolError(f"Superset could not run {tool_name}.")
    return (
        result.structured_content
        if result.structured_content is not None
        else result.data
    )


def _run_mcp_tool(tool_name: str, request: BaseModel) -> dict[str, Any]:
    """Run FastMCP off the agent loop with isolated Flask request state."""
    from flask import current_app, g

    try:
        app = current_app._get_current_object()
        user = getattr(g, "user", None)
    except RuntimeError as ex:
        raise ToolError("Authoring requires an authenticated request.") from ex

    username = getattr(user, "username", None)
    email = getattr(user, "email", None)
    if not username and not email:
        raise ToolError("Authoring requires an authenticated user.")

    outcome: dict[str, Any] = {}

    def run() -> None:
        try:
            from flask import g as worker_g

            from superset.mcp_service.auth import (
                load_user_with_relationships,
                mcp_user_context,
            )

            with app.test_request_context():
                worker_g.user = load_user_with_relationships(
                    username=str(username) if username else None,
                    email=str(email) if email else None,
                )
                if worker_g.user is None:
                    raise ToolError("The authenticated user could not be reloaded.")
                with mcp_user_context(worker_g.user):
                    outcome["value"] = asyncio.run(_call_mcp_tool(tool_name, request))
        except BaseException as ex:  # noqa: BLE001
            outcome["error"] = ex

    worker = Thread(target=run, name="superset-ai-authoring", daemon=True)
    worker.start()
    worker.join(float(app.config.get("AI_AGENT_TIMEOUT_SECONDS", 300)))

    if worker.is_alive():
        raise ToolError(
            "Superset authoring timed out. The operation may still complete; "
            "check for the asset before retrying."
        )

    if error := outcome.get("error"):
        raise error
    return _payload(outcome.get("value"))


def _invoke(
    caller: ToolCaller | None,
    tool_name: str,
    request: BaseModel,
) -> dict[str, Any]:
    return _payload(caller(request) if caller else _run_mcp_tool(tool_name, request))


def _error_message(error: Any, fallback: str) -> str:
    """Keep an authoring failure useful without exposing connection detail."""
    if not isinstance(error, dict):
        return str(error or fallback)

    parts = [str(error.get("message") or fallback)]
    if error.get("error_type") != "database_connection_error" and error.get("details"):
        parts.append(str(error["details"])[:2000])
    suggestions = error.get("suggestions")
    if isinstance(suggestions, list) and suggestions:
        parts.append("Suggestions: " + "; ".join(map(str, suggestions[:3])))
    return " ".join(parts)


class CreateVirtualDatasetTool(AITool):
    """Save a read-only query as a chartable virtual dataset."""

    name: ClassVar[str] = "create_virtual_dataset"
    description: ClassVar[str] = (
        "Create a Superset virtual dataset from a read-only SELECT. Use it when "
        "a chart needs a join or derived column not present in one physical "
        "dataset. Use the returned dataset_id with generate_chart. The current "
        "user must have Dataset write and database access."
    )
    input_schema: ClassVar[dict[str, Any]] = _tool_schema(CreateVirtualDatasetRequest)

    def __init__(self, caller: ToolCaller | None = None) -> None:
        self._caller = caller

    def run(self, **kwargs: Any) -> ToolOutput:
        request = _validate(CreateVirtualDatasetRequest, kwargs, "virtual dataset")
        response = _invoke(self._caller, self.name, request)
        if error := response.get("error"):
            raise ToolError(_error_message(error, "Virtual dataset creation failed."))

        payload = {
            "dataset_id": response.get("id"),
            "dataset_name": response.get("dataset_name"),
            "database_id": response.get("database_id"),
            "columns": response.get("columns", []),
            "url": response.get("url"),
        }
        return ToolOutput.of(
            payload,
            display={
                "kind": "dataset_authoring",
                "dataset_id": payload["dataset_id"],
                "dataset_name": payload["dataset_name"],
                "url": payload["url"],
            },
        )


class GenerateChartTool(AITool):
    """Create a real Superset chart or an unsaved inline preview."""

    name: ClassVar[str] = "generate_chart"
    description: ClassVar[str] = (
        "Create a Superset chart from a dataset and chart configuration. Use "
        "save_chart=false for an inline preview or save_chart=true when the user "
        "asked to persist it. A dashboard can only use saved chart IDs. On "
        "success, reproduce chat_embed_markdown verbatim in the answer. The "
        "current user must have Chart write and dataset access."
    )
    input_schema: ClassVar[dict[str, Any]] = _tool_schema(GenerateChartRequest)

    def __init__(self, caller: ToolCaller | None = None) -> None:
        self._caller = caller

    def run(self, **kwargs: Any) -> ToolOutput:
        if isinstance(kwargs.get("config"), str):
            try:
                kwargs["config"] = json.loads(kwargs["config"])
            except json.JSONDecodeError as ex:
                raise ToolError(
                    "Invalid chart request: config must be a valid JSON object."
                ) from ex

        request = _validate(GenerateChartRequest, kwargs, "chart")
        response = _invoke(self._caller, self.name, request)
        if response.get("success") is False:
            raise ToolError(
                _error_message(response.get("error"), "Chart generation failed.")
            )

        chart = response.get("chart")
        chart_id = chart.get("id") if isinstance(chart, dict) else None
        form_data_key = response.get("form_data_key")
        payload = {
            "success": bool(response.get("success", True)),
            "chart_id": chart_id,
            "form_data_key": form_data_key,
            "explore_url": response.get("explore_url"),
            "warnings": response.get("warnings", []),
        }
        if isinstance(form_data_key, str) and form_data_key:
            payload["chat_embed_markdown"] = (
                f"```superset-chart\nform_data_key={form_data_key}\nheight=320\n```"
            )
        return ToolOutput.of(
            payload,
            display={
                "kind": "chart_authoring",
                "success": payload["success"],
                "chart_id": chart_id,
                "form_data_key": form_data_key,
                "explore_url": payload["explore_url"],
            },
        )


class GenerateDashboardTool(AITool):
    """Assemble saved charts into a Superset dashboard."""

    name: ClassVar[str] = "generate_dashboard"
    description: ClassVar[str] = (
        "Create a Superset dashboard from saved chart IDs when the user "
        "explicitly asks to persist a dashboard. The current user must have "
        "Dashboard write access and access to every included chart. Return the "
        "dashboard URL to the user."
    )
    input_schema: ClassVar[dict[str, Any]] = _tool_schema(GenerateDashboardRequest)

    def __init__(self, caller: ToolCaller | None = None) -> None:
        self._caller = caller

    def run(self, **kwargs: Any) -> ToolOutput:
        request = _validate(GenerateDashboardRequest, kwargs, "dashboard")
        response = _invoke(self._caller, self.name, request)
        if error := response.get("error"):
            raise ToolError(_error_message(error, "Dashboard generation failed."))

        dashboard = response.get("dashboard")
        dashboard_id = dashboard.get("id") if isinstance(dashboard, dict) else None
        dashboard_url = response.get("dashboard_url")
        payload = {
            "dashboard_id": dashboard_id,
            "dashboard_url": dashboard_url,
            "warnings": response.get("warnings", []),
        }
        if isinstance(dashboard_url, str) and dashboard_url:
            payload["chat_link_markdown"] = f"[Open dashboard]({dashboard_url})"
        return ToolOutput.of(
            payload,
            display={
                "kind": "dashboard_authoring",
                "dashboard_id": dashboard_id,
                "dashboard_url": dashboard_url,
            },
        )
