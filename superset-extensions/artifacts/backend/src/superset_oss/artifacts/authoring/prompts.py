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
The authoring prompts, as MCP prompts.

The host prefixes their names, so agents see
``extensions.superset-oss.artifacts.create_artifact`` and
``extensions.superset-oss.artifacts.import_claude_artifact``. While the tools
would answer ``NOT_ENABLED``, both prompts say artifacts are off instead;
otherwise ``create_artifact`` teaches what the policy in force allows.
"""

from __future__ import annotations

from superset_core.mcp.decorators import prompt
from superset_oss.artifacts.authoring.prompt_text import (
    create_artifact_text,
    import_claude_artifact_text,
    NOT_ENABLED_TEXT,
)
from superset_oss.artifacts.errors import ArtifactError
from superset_oss.artifacts.gate import artifacts_on, open_artifacts


@prompt(
    "create_artifact",
    title="Write a Superset artifact",
    description=(
        "Read before writing an artifact: the sandbox rules, the file tools, "
        "manifest.json and its bindings, window.superset, and how publishing "
        "waits for the user."
    ),
)
async def create_artifact() -> str:
    """The authoring contract an agent reads before it writes an artifact."""
    try:
        artifacts = open_artifacts()
    except ArtifactError:
        return NOT_ENABLED_TEXT
    return create_artifact_text(artifacts.policy)


@prompt(
    "import_claude_artifact",
    title="Bring a Claude artifact to Superset",
    description=(
        "Adapt an artifact made in Claude: Claude-only APIs, shadcn and CDN "
        "imports, and hard-coded data turned into bindings or a snapshot."
    ),
)
async def import_claude_artifact() -> str:
    """How to bring an artifact made in Claude to Superset."""
    return import_claude_artifact_text() if artifacts_on() else NOT_ENABLED_TEXT
