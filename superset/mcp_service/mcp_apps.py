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

"""MCP Apps metadata: which tools feed a View, and who may see them.

A tool takes part in MCP Apps through ``_meta.ui``: ``resourceUri`` links the
View (a ``ui://`` resource) that renders its result, and ``visibility`` names
its audience, ``"model"``, ``"app"`` or both. The spec's default is both, so a
View may call any tool that declares no audience. Hosts apply visibility; the
server can't tell a View's call from the model's, since both arrive on the
viewer's connection, so visibility here is audience metadata and never
authorization.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from fastmcp.apps.config import AppConfig
from fastmcp.server.transforms import Transform

UI_META_KEY = "ui"
UI_URI_SCHEME = "ui://"
MODEL_ONLY: tuple[str, ...] = ("model",)


def model_only_meta() -> dict[str, Any]:
    """``_meta`` for a tool only the model may call, such as the search proxies."""
    return {UI_META_KEY: {"visibility": list(MODEL_ONLY)}}


def ui_meta(component: Any) -> Mapping[str, Any] | None:
    """The component's ``_meta.ui`` mapping, when it declares one."""
    meta = getattr(component, "meta", None)
    ui = meta.get(UI_META_KEY) if isinstance(meta, Mapping) else None
    return ui if isinstance(ui, Mapping) else None


def declared_visibility(component: Any) -> list[str] | None:
    """The audience the component declares, or ``None`` when it declares none."""
    ui = ui_meta(component)
    visibility = ui.get("visibility") if ui is not None else None
    return list(visibility) if isinstance(visibility, (list, tuple)) else None


def feeds_view(component: Any) -> bool:
    """Whether a View depends on this tool: it links one, or apps may call it.

    Only what the tool declares counts. A tool with no audience is not treated
    as app-callable here, even though the spec's default includes apps.
    """
    ui = ui_meta(component)
    if ui is None:
        return False
    if ui.get("resourceUri"):
        return True
    visibility = declared_visibility(component)
    return visibility is not None and "app" in visibility


def with_visibility(tool: Any, visibility: tuple[str, ...]) -> Any:
    """A copy of ``tool`` declaring ``visibility``, keeping the rest of its meta."""
    meta = dict(tool.meta or {})
    meta[UI_META_KEY] = {**(ui_meta(tool) or {}), "visibility": list(visibility)}
    return tool.model_copy(update={"meta": meta})


def tool_meta(
    meta: Mapping[str, Any] | None, app: AppConfig | Mapping[str, Any] | None
) -> dict[str, Any] | None:
    """A tool's ``_meta``, with its MCP Apps settings validated.

    ``app`` takes FastMCP's ``AppConfig`` (or its wire-format mapping) and
    becomes ``_meta.ui``; a ``ui`` key already in ``meta`` is validated the
    same way. Declaring both is refused, so one tool can't carry two answers.
    """
    if meta is None and app is None:
        return None
    merged: dict[str, Any] = dict(meta or {})
    if app is not None:
        if UI_META_KEY in merged:
            raise ValueError("Pass MCP Apps settings as app= or meta['ui'], not both")
        merged[UI_META_KEY] = app
    if UI_META_KEY not in merged:
        return merged
    config = (
        merged[UI_META_KEY]
        if isinstance(merged[UI_META_KEY], AppConfig)
        else AppConfig.model_validate(merged[UI_META_KEY])
    )
    if config.resource_uri is not None and not config.resource_uri.startswith(
        UI_URI_SCHEME
    ):
        raise ValueError(
            f"An MCP Apps resource URI must start with {UI_URI_SCHEME}, "
            f"got {config.resource_uri!r}"
        )
    if config.visibility is not None and not config.visibility:
        raise ValueError("An MCP Apps visibility must name at least one audience")
    merged[UI_META_KEY] = config.model_dump(by_alias=True, exclude_none=True)
    return merged


class ModelOnlyByDefaultTransform(Transform):
    """List tools that declare no audience as model-only, once a View exists.

    MCP Apps' default visibility is ``["model", "app"]``, so in a compliant
    host any View could call every tool that declares nothing, with the
    viewer's rights. As soon as one listed tool feeds a View, this transform
    lists every tool without a declared visibility as ``["model"]``; tools
    that declare one keep it. Without any View the listing is unchanged.

    Only the listing changes: hosts read visibility from ``tools/list``, and
    calls resolve the registered tool. The call-tool proxy checks the same
    listing, so it reaches only what the model may see.
    """

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}()"

    async def list_tools(self, tools: Sequence[Any]) -> Sequence[Any]:
        if not any(feeds_view(tool) for tool in tools):
            return tools
        return [
            tool
            if declared_visibility(tool) is not None
            else with_visibility(tool, MODEL_ONLY)
            for tool in tools
        ]
