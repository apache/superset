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
"""What extensions add to the MCP server's instructions, and how it is shown."""

from __future__ import annotations

import logging
import textwrap

from superset_core.mcp.instructions import InstructionsSource

from superset.extensions.context import (
    ConcreteExtensionContext,
    get_current_extension_context,
    use_context,
)

logger = logging.getLogger(__name__)

HEADING = "Notes from the extensions installed here, on their own tools:"

_contributions: list[tuple[ConcreteExtensionContext, InstructionsSource]] = []


def contribute_instructions(source: InstructionsSource) -> None:
    """See ``superset_core.mcp.instructions.contribute_instructions``."""
    context = get_current_extension_context()
    if context is None:
        raise RuntimeError(
            "contribute_instructions() must be called by an extension, while it loads"
        )
    if not callable(source) and not isinstance(source, str):
        raise TypeError("MCP instructions must be text or a callable that answers it")
    _contributions.append((context, source))


def has_dynamic_contributions() -> bool:
    """Whether some extension's guidance depends on when it is asked."""
    return any(callable(source) for _, source in _contributions)


def _text(context: ConcreteExtensionContext, source: InstructionsSource) -> str:
    if not callable(source):
        return source.strip()
    try:
        with use_context(context):
            answer = source()
    except Exception:  # noqa: BLE001 pylint: disable=broad-except
        logger.warning(
            "MCP instructions from extension %s failed; leaving them out",
            context.extension.id,
            exc_info=True,
        )
        return ""
    return answer.strip() if isinstance(answer, str) else ""


def extension_guidance() -> str:
    """
    The section of the instructions that the extensions' guidance makes, each
    under its extension's id, or nothing when there is none.
    """
    notes = [
        (context.extension.id, text)
        for context, source in _contributions
        if (text := _text(context, source))
    ]
    if not notes:
        return ""
    lines = [HEADING]
    for extension_id, text in notes:
        body = textwrap.indent(text, "  ")
        lines.append(f"- {extension_id}:\n{body}")
    return "\n".join(lines) + "\n\n"


def reset() -> None:
    """Forget every contribution, as a fresh process would."""
    _contributions.clear()
