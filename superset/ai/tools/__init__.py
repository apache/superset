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
The tools the assistant can call.

Every tool authorizes itself: the registry does not check permissions on a
tool's behalf, so a tool that returns or mutates a data-bearing object performs
its own ``security_manager`` check. See :mod:`superset.ai.tools.base` for the
contract. Shipped profiles remain read-only; deployments opt into authoring by
naming the mutation tools in a profile.

A runtime asks for a named bundle rather than assembling tools itself::

    registry = build_registry(BUNDLE_ALL)
    definitions = registry.definitions()
    result = registry.dispatch(tool_call)

Only :mod:`superset.ai.tools.base` is imported at module scope. The tool modules
themselves are imported lazily by the bundle factories, because they reach into
models, DAOs and the security manager, and this package is imported from
configuration-time code that must not drag that in.
"""

from __future__ import annotations

from superset.ai.tools.base import (
    AITool as AITool,
    build_registry as build_registry,
    BUNDLE_ALL as BUNDLE_ALL,
    BUNDLE_DISCOVERY as BUNDLE_DISCOVERY,
    bundle_names as bundle_names,
    BUNDLE_READ_ONLY as BUNDLE_READ_ONLY,
    ToolError as ToolError,
    ToolRegistry as ToolRegistry,
)

__all__ = [
    "AITool",
    "BUNDLE_ALL",
    "BUNDLE_DISCOVERY",
    "BUNDLE_READ_ONLY",
    "ToolError",
    "ToolRegistry",
    "build_registry",
    "bundle_names",
]
