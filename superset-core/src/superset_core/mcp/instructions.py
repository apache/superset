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
Guidance an extension adds to the MCP server's instructions.

The server's instructions tell agents how to use Superset's tools. An extension
whose tools need guidance beyond each tool's own description, such as when an
agent should reach for them, contributes it while its entry point loads. The
host lists each extension's guidance under the extension's id, after its own
rules, which it doesn't change.

Usage:
    from superset_core.mcp.instructions import contribute_instructions

    contribute_instructions("Use the board tools for a board the user names.")
    contribute_instructions(lambda: BOARD_GUIDANCE if boards_enabled() else None)
"""

from __future__ import annotations

from typing import Callable, TypeAlias

InstructionsSource: TypeAlias = str | Callable[[], str | None]


def contribute_instructions(source: InstructionsSource) -> None:
    """
    Add guidance to the MCP server's instructions, as the extension that calls
    it while it loads.

    A string is added as it is. A callable is asked as each MCP session starts,
    in the app context, and adds what it answers: nothing for ``None``, an
    empty answer or an exception, so that it can follow state that changes
    while the server runs. Keep it cheap: every session waits for it.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param source: The guidance, or a callable that answers it.
    :raises RuntimeError: If called outside an extension's context.
    :raises TypeError: If ``source`` is neither text nor a callable.
    """
    raise NotImplementedError("Function will be replaced during initialization")
