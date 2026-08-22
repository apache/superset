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
An extension point for MCP servers a deployment operates itself.

Superset ships no integration with any external service. This package is the
seam through which a deployment attaches its own — a catalog, a knowledge base,
a ticket system — by naming servers in ``AI_AGENT_MCP_SERVERS`` and referencing
those names from an agent profile's ``mcp_servers``. With the setting empty
nothing here is reached and the assistant behaves exactly as it does without it.

Three modules, in dependency order:

:mod:`~superset.ai.mcp.config`
    Parses and validates the setting into typed objects. Pure; imports no SDK.
:mod:`~superset.ai.mcp.client`
    Connects, lists tools, calls one. The ``mcp`` SDK is imported inside the
    functions that need it, so a deployment without it installed still starts.
:mod:`~superset.ai.mcp.tools`
    Adapts a discovered remote tool into an :class:`~superset.ai.tools.base.AITool`
    so it flows through the existing registry, size caps and policy chain
    unchanged.

Nothing is imported at package scope, because :mod:`superset.ai.mcp.config` is
reached from configuration-time code that must not drag in a transport.

A server is untrusted in both directions. It may return content crafted to
redirect the model, so everything it returns is wrapped as untrusted content
before the model sees it; and it may ask for more than a catalog lookup, so only
the headers configured for that server are ever sent to it and
:class:`~superset.ai.policy.ForeignToolPolicy` refuses the tool shapes that would
bypass Superset's own SQL controls.
"""
