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
The bridge protocol between an artifact's frame and its host (E6).

The frame runs the artifact's code on an opaque origin, with no network; the
host is the Superset page around it. They talk only through ``postMessage``.
Every message is an object with a ``type`` and the channel key ``k``: the host
makes a new key for each frame and passes it, with the capability grant and
the host's origin, in the iframe's ``name``. Each side drops messages from
any other window or with any other key.

Host to frame:

- ``state``: everything the frame may know, sent whenever it changes:
  ``{status, bindings: {name: {rows, columns?, definitions?}}, filters,
  theme?, error?}``. The host leaves out what the grant doesn't cover:
  bindings and filters need ``data``, the theme needs ``theme``.

Frame to host:

- ``ready``: the runtime is listening. It carries ``protocol`` and
  ``version`` (the handshake); the host answers with the latest ``state``.
- ``request``: one of ``query`` (rerun a binding with new values for its
  declared parameters), ``setCrossFilter``, ``emit`` (a declared data event)
  and ``refresh``. The host checks each one against the grant
  (``REQUEST_CAPABILITIES``) and then against the manifest before acting.
- ``error``: an uncaught error or unhandled rejection in the frame, reported
  for the artifact's author.

The TypeScript package ``@apache-superset/artifact-sdk`` implements both
sides and shares these constants.
"""

# Review finding M5 (pending): adopt the MCP Apps protocol and SDK after a
# spike; M9 and M10 (pending): MCP Apps names for theme variables and CSP
# settings; K15 (pending): an Arrow envelope for binding data.

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType

from superset_core.artifacts.capabilities import Capability

PROTOCOL_NAME = "superset-artifacts"
PROTOCOL_VERSION = 1

HOST_MESSAGE_TYPES: tuple[str, ...] = ("state",)
FRAME_MESSAGE_TYPES: tuple[str, ...] = ("ready", "request", "error")
REQUEST_TYPES: tuple[str, ...] = ("query", "setCrossFilter", "emit", "refresh")

# The capability each request needs.
REQUEST_CAPABILITIES: Mapping[str, Capability] = MappingProxyType(
    {
        "query": Capability.DATA,
        "setCrossFilter": Capability.CROSS_FILTER,
        "emit": Capability.EVENTS,
        "refresh": Capability.REFRESH,
    }
)
