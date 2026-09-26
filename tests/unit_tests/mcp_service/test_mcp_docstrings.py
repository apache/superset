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

"""Guard against malformed MCP tool and prompt docstrings.

FastMCP parses every registered tool and prompt docstring with griffe to
derive the description and the per-argument descriptions it publishes to
clients. A docstring griffe cannot parse makes griffe log a warning naming
the offending line, and any entry naming something that is not a real
parameter is dropped instead of reaching the published schema.

FastMCP pins the griffe logger to ERROR when it is imported, so whether those
warnings reach a given deployment's logs depends on that deployment's logging
configuration. This module raises the level back to WARNING so the build fails
on the malformed docstring itself rather than on whether anything happens to
be listening.
"""

import asyncio
import inspect
import logging
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from fastmcp.utilities.docstring_parsing import parse_docstring

from superset.mcp_service.app import mcp

# Griffe emits its parsing diagnostics through a single logger of this name.
GRIFFE_LOGGER = "griffe"


@contextmanager
def _captured_griffe_warnings() -> Iterator[list[str]]:
    """Collect griffe warnings, bypassing any level FastMCP has imposed."""
    messages: list[str] = []

    class _Collector(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            messages.append(record.getMessage())

    logger = logging.getLogger(GRIFFE_LOGGER)
    handler = _Collector(level=logging.WARNING)
    previous_level = logger.level
    logger.setLevel(logging.WARNING)
    logger.addHandler(handler)
    try:
        yield messages
    finally:
        logger.removeHandler(handler)
        logger.setLevel(previous_level)


def _registered_functions() -> list[tuple[str, Any]]:
    """Pair every registered tool and prompt with its underlying function.

    A list rather than a dict: ``list_tools()`` returns every version of a
    tool without deduplicating, and a prompt may share a tool's name, so
    keying by name alone would silently drop components from the guard.
    """
    tools = asyncio.run(mcp.list_tools())
    prompts = asyncio.run(mcp.list_prompts())
    functions = []
    for kind, components in (("tool", tools), ("prompt", prompts)):
        for component in components:
            fn = getattr(component, "fn", None)
            if fn is not None:
                functions.append((f"{kind} {component.name}", fn))
    return functions


def test_registered_functions_are_discoverable() -> None:
    """The guard below is only meaningful if it sees the real functions."""
    labels = {label for label, _ in _registered_functions()}
    assert "tool health_check" in labels
    assert "tool get_schema" in labels
    assert "prompt quickstart" in labels


def test_mcp_docstrings_parse_without_griffe_warnings() -> None:
    """No registered tool or prompt docstring may produce a griffe warning."""
    offenders: dict[str, list[str]] = {}
    for label, fn in _registered_functions():
        with _captured_griffe_warnings() as messages:
            parse_docstring(fn)
        if messages:
            offenders[label] = messages

    assert not offenders, (
        "Malformed MCP docstrings — griffe cannot parse these, so each one "
        "logs a warning naming the offending line every time the module is "
        "imported:\n"
        + "\n".join(f"  {label}: {msgs}" for label, msgs in sorted(offenders.items()))
    )


def test_documented_arguments_reach_the_published_schema() -> None:
    """Every documented argument must match a real parameter of the function."""
    mismatched: dict[str, list[str]] = {}
    for label, fn in _registered_functions():
        parsed = parse_docstring(fn)
        if not parsed.parameters:
            continue
        signature_params = set(inspect.signature(fn).parameters)
        unknown = sorted(set(parsed.parameters) - signature_params)
        if unknown:
            mismatched[label] = unknown

    assert not mismatched, (
        "Docstrings document arguments that do not exist on the function, so "
        "their descriptions never reach the published schema:\n"
        + "\n".join(f"  {label}: {args}" for label, args in sorted(mismatched.items()))
    )
