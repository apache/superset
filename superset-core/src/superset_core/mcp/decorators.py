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
MCP (Model Context Protocol) tool registration for Superset MCP server.

This module provides a decorator interface to register MCP tools, prompts and
MCP Apps Views with the host application.

Usage:
    from superset_core.mcp.decorators import tool

    @tool(name="my_tool", description="Custom business logic", tags=["extension"])
    def my_extension_tool(param: str) -> dict:
        return {"message": f"Hello {param}!"}

    # Or use function name and docstring:
    @tool
    def another_tool(value: int) -> str:
        '''Tool description from docstring'''
        return str(value * 2)
"""

from typing import Any, Callable, TypeVar

try:
    from mcp.types import ToolAnnotations
except (
    ImportError
):  # MCP extras may not be installed in superset-core-only environments
    ToolAnnotations = dict

try:
    from fastmcp.apps.config import AppConfig
except ImportError:  # FastMCP is an MCP extra as well
    AppConfig = dict

# Type variable for decorated functions
F = TypeVar("F", bound=Callable[..., Any])


def tool(
    func_or_name: str | Callable[..., Any] | None = None,
    *,
    name: str | None = None,
    description: str | None = None,
    tags: list[str] | None = None,
    protect: bool = True,
    class_permission_name: str | None = None,
    method_permission_name: str | None = None,
    annotations: ToolAnnotations | None = None,
    meta: dict[str, Any] | None = None,
    app: AppConfig | dict[str, Any] | None = None,
) -> Any:  # Use Any to avoid mypy issues with dependency injection
    """
    Decorator to register an MCP tool with optional authentication.

    This decorator combines FastMCP tool registration with optional authentication
    and RBAC permission checking.

    Can be used as:
        @tool
        def my_tool(): ...

    Or:
        @tool(name="custom_name", protect=False)
        def my_tool(): ...

    Args:
        func_or_name: When used as @tool, this will be the function.
                     When used as @tool("name"), this will be the name.
        name: Tool name (defaults to function name, prefixed with extension ID)
        description: Tool description (defaults to function docstring)
        tags: List of tags for categorizing the tool (defaults to empty list)
        protect: Whether to require Superset authentication (defaults to True)
        class_permission_name: FAB view/resource name for RBAC checking
            (e.g., "Chart", "Dashboard", "SQLLab"). When set, enables
            permission checking via security_manager.can_access().
        method_permission_name: FAB action name (e.g., "read", "write").
            Defaults to "write" if tags includes "mutate", else "read".
        annotations: MCP tool annotations (title, readOnlyHint, destructiveHint, etc.)
            These hints help MCP clients understand tool behavior and safety.
        meta: Optional ``_meta`` dict attached to the tool definition. Used by the
            MCP Apps extension to link a tool to an interactive UI resource via
            ``{"ui": {"resourceUri": "ui://..."}}`` so hosts render its result as
            a widget. See https://modelcontextprotocol.io/extensions/apps/overview.
        app: MCP Apps settings, as FastMCP's ``AppConfig`` or its wire-format
            dict, served as the tool's ``_meta.ui``: ``resource_uri`` links a
            View (see :func:`resource`) and ``visibility`` names the tool's
            audience, ``["model"]``, ``["app"]`` or both. A ``ui`` entry in
            ``meta`` is validated the same way; pass one or the other.
            Visibility is audience metadata that hosts apply, not
            authorization: check every argument on the server. Once any tool
            links a View or declares an ``"app"`` audience, tools that declare
            no visibility are listed as ``["model"]``.

    Returns:
        Decorator function that registers and wraps the tool, or the wrapped function

    Raises:
        NotImplementedError: If called before host implementation is initialized

    Example:
        @tool(name="my_tool", description="Does something useful", tags=["utility"])
        def my_custom_tool(param: str) -> dict:
            return {"result": param}

        @tool  # Uses function name and docstring with auth
        def simple_tool(value: int) -> str:
            '''Doubles the input value'''
            return str(value * 2)

        @tool(protect=False)  # No authentication required
        def public_tool() -> str:
            '''Public tool accessible without auth'''
            return "Hello world"

        @tool(class_permission_name="Chart")  # RBAC: requires can_read on Chart
        def list_charts() -> list:
            '''List charts the user can access'''
            return []

        @tool(  # RBAC: can_write on Chart
            tags=["mutate"], class_permission_name="Chart",
        )
        def create_chart(name: str) -> dict:
            '''Create a new chart'''
            return {"name": name}
    """
    raise NotImplementedError(
        "MCP tool decorator not initialized. "
        "This decorator should be replaced during Superset startup."
    )


def prompt(
    func_or_name: str | Callable[..., Any] | None = None,
    *,
    name: str | None = None,
    title: str | None = None,
    description: str | None = None,
    tags: set[str] | None = None,
    protect: bool = True,
) -> Any:  # Use Any to avoid mypy issues with dependency injection
    """
    Decorator to register an MCP prompt with optional authentication.

    This decorator combines FastMCP prompt registration with optional authentication.

    Can be used as:
        @prompt
        async def my_prompt_handler(): ...

    Or:
        @prompt("my_prompt")
        async def my_prompt_handler(): ...

    Or:
        @prompt("my_prompt", protected=False, title="Custom Title")
        async def my_prompt_handler(): ...

    Args:
        func_or_name: When used as @prompt, this will be the function.
                     When used as @prompt("name"), this will be the name.
        name: Prompt name (defaults to function name if not provided)
        title: Prompt title (defaults to function name)
        description: Prompt description (defaults to function docstring)
        tags: Set of tags for categorizing the prompt
        protect: Whether to require Superset authentication (defaults to True)

    Returns:
        Decorator function that registers and wraps the prompt, or the wrapped function

    Raises:
        NotImplementedError: If called before host implementation is initialized

    Example:
        @prompt
        async def my_prompt_handler(ctx: Context) -> str:
            '''Interactive prompt for doing something.'''
            return "Prompt instructions here..."

        @prompt("custom_prompt", protect=False, title="Custom Title")
        async def public_prompt_handler(ctx: Context) -> str:
            '''Public prompt accessible without auth'''
            return "Public prompt accessible without auth"
    """
    raise NotImplementedError(
        "MCP prompt decorator not initialized. "
        "This decorator should be replaced during Superset startup."
    )


def content_version(content: str | bytes) -> str:
    """
    A version segment for a View's URI, taken from a digest of its content.

    MCP Apps hosts cache a View by its URI, so a View whose content changes
    needs a new URI. Pass ``content_version(html)`` as :func:`resource`'s
    ``version`` and every build of the page gets a URI of its own.

    Args:
        content: The View's content, such as its HTML

    Returns:
        ``"v1-"`` followed by the first 12 hex digits of the content's SHA-256
        digest (``str`` content is encoded as UTF-8)

    Raises:
        NotImplementedError: If called before host implementation is initialized
    """
    raise NotImplementedError(
        "MCP content_version not initialized. "
        "This function should be replaced during Superset startup."
    )


def resource(
    path: str,
    *,
    name: str | None = None,
    title: str | None = None,
    description: str | None = None,
    app: AppConfig | dict[str, Any] | None = None,
    version: str | None = None,
    protect: bool = True,
) -> Any:  # Use Any to avoid mypy issues with dependency injection
    """
    Decorator to register an MCP Apps View: an HTML ``ui://`` resource that
    MCP Apps hosts render for the result of a tool that links it.

    The decorated function returns the View's HTML. Its URI is scoped to its
    owner, like tool names: ``ui://extensions/<publisher>/<name>/<path>`` for
    an extension and ``ui://superset/<path>`` for the host, followed by
    ``/<version>`` when one is given. The function the decorator returns
    carries that URI as ``.uri``, for the tools that link the View, even in a
    process that serves no MCP and so registers nothing.

    Args:
        path: The View's path under its owner's prefix, such as ``"viewer"``:
            ``/``-separated segments of letters, digits, ``-``, ``.``, ``_``
            and ``~``
        name: Resource name (defaults to the function name)
        title: Resource title
        description: Resource description (defaults to the function docstring)
        app: MCP Apps settings for the View, as FastMCP's ``AppConfig`` or its
            wire-format dict: ``csp``, ``permissions``, ``domain`` and
            ``prefers_border``, served as ``_meta.ui`` when the View is listed
            and when it is read. With no ``csp``, hosts apply their most
            restrictive policy. ``resource_uri`` and ``visibility`` belong to
            tools and are refused here.
        version: A last URI segment, such as ``content_version(html)``, made of
            the same characters as a path segment
        protect: Whether to require Superset authentication (defaults to True)

    Returns:
        Decorator that registers the View and returns the function, wrapped
        for authentication when protected, which carries the View's URI as
        ``uri``

    Raises:
        NotImplementedError: If called before host implementation is initialized

    Example:
        VIEWER_HTML = (Path(__file__).parent / "viewer.html").read_text()

        @resource("viewer", version=content_version(VIEWER_HTML))
        def viewer() -> str:
            '''The page that shows a thing.'''
            return VIEWER_HTML

        @tool(app={"resourceUri": viewer.uri, "visibility": ["model", "app"]})
        def show_thing(thing_id: int) -> dict:
            '''Show a thing in the conversation.'''
            ...

        @tool(app={"visibility": ["app"]})
        def thing_rows(thing_id: int) -> dict:
            '''The rows the View asks for; never offered to the model.'''
            ...
    """
    raise NotImplementedError(
        "MCP resource decorator not initialized. "
        "This decorator should be replaced during Superset startup."
    )
