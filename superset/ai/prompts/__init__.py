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
System prompt assembly and the generic sections Superset itself ships.

``superset.ai.prompts.core`` holds sections that are true of every deployment.
Anything true of only one deployment reaches the prompt through a
:class:`~superset.ai.knowledge.KnowledgeProvider`.
"""

from __future__ import annotations

from superset.ai.prompts.assemble import (
    assemble_system_prompt,
    build_time_anchor,
    CORE_ONLY_KINDS,
    CORE_SOURCE,
    find_unmarked_tool_references,
    order_sections,
    PromptAssemblyError,
    PromptContext,
    PromptMutator,
    PromptSection,
    SectionKind,
    TOOL_REFERENCE_PREFIX,
    validate_core_section,
)

__all__ = [
    "CORE_ONLY_KINDS",
    "CORE_SOURCE",
    "PromptAssemblyError",
    "PromptContext",
    "PromptMutator",
    "PromptSection",
    "SectionKind",
    "TOOL_REFERENCE_PREFIX",
    "assemble_system_prompt",
    "build_time_anchor",
    "find_unmarked_tool_references",
    "order_sections",
    "validate_core_section",
]
