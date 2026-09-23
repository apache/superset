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
The sections Superset itself ships.

Four of them, deliberately: what the assistant may not do, who it is and how it
grounds a claim, portable query craft, and how Superset behaves. Everything here
is paid on every request, so a fifth section has to earn its tokens against the
alternative of being served on demand by the knowledge tool.

Nothing in this package may name a table, a hostname or a business metric. That
is not a style guideline -- :func:`~superset.ai.prompts.assemble.assemble_system_prompt`
refuses to render a core section that does.
"""

from __future__ import annotations

from superset.ai.prompts.assemble import (
    build_time_anchor,
    CORE_SOURCE,
    PromptSection,
    SectionKind,
)
from superset.ai.prompts.core import persona, safety, sql_conventions, superset_product


def core_sections(tz: str | None = None) -> tuple[PromptSection, ...]:
    """
    Every always-on section, including the date anchor.

    The anchor is built here rather than declared as a constant because it is the
    one section whose body depends on when it is rendered. It sorts last: it is
    the shortest block and the one the model should have most recently in view
    when it starts doing date arithmetic.

    :param tz: IANA timezone for the anchor. ``None`` reads
        ``AI_ASSISTANT_TIMEZONE`` from config, defaulting to UTC.
    """
    return (
        safety.SECTION,
        persona.SECTION,
        sql_conventions.SECTION,
        superset_product.SECTION,
        PromptSection(
            key="core.time_anchor",
            body=build_time_anchor(tz),
            kind=SectionKind.PROCESS,
            source=CORE_SOURCE,
            order=900,
        ),
    )


__all__ = ["core_sections"]
