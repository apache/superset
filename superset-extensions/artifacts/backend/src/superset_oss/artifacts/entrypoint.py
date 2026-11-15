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
The backend entry point: importing each piece registers what it declares.

The host imports this module inside the extension's context, so every id it
registers is prefixed ``extensions.superset-oss.artifacts.``. Registration
doesn't depend on a provider; every tool and endpoint answers ``NOT_ENABLED``
while no artifact runtime provider is registered.
"""

from __future__ import annotations

import logging

from superset_oss.artifacts.authoring import confirm_api  # noqa: F401
from superset_oss.artifacts.canvas import widget  # noqa: F401
from superset_oss.artifacts.embedding import api as embedding_api  # noqa: F401
from superset_oss.artifacts.frames import api as frames_api  # noqa: F401

logger = logging.getLogger(__name__)

try:
    from superset_oss.artifacts.authoring import prompts, tools  # noqa: F401
except (ImportError, NotImplementedError):
    # TODO: MCP decorators that work without the MCP extras installed. Until
    # then, a process without them registers the widget and the REST endpoints,
    # and skips the tools and prompts rather than losing the whole backend.
    # Without the extras the host leaves superset_core's @tool and @prompt
    # unimplemented, and they raise NotImplementedError.
    logger.warning(
        "Artifacts: MCP isn't available, so the authoring tools and prompts "
        "aren't registered in this process",
        exc_info=True,
    )
