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
Capabilities: the named rights an artifact declares and a host grants.

An artifact lists the capabilities it needs in its manifest. For each context
it renders the artifact in (a canvas, an embedded page, a standalone page),
the host grants a subset of them and passes that grant to the frame. Both
sides check the grant; the host's check is the authoritative one, because the
frame runs untrusted code.
"""

from __future__ import annotations

from enum import StrEnum


class Capability(StrEnum):
    """A named right that an artifact must declare in its manifest and be granted."""

    # Receive the results of the manifest's named bindings and the filters
    # that reach the artifact, and ask to rerun a binding with new values for
    # its declared parameters.
    DATA = "data"
    # Set cross-filters that the other widgets on the canvas follow.
    CROSS_FILTER = "cross_filter"
    # Emit the declared data events other than cross-filters: selection,
    # highlight and drill.
    EVENTS = "events"
    # Ask the host to run the artifact's bindings again.
    REFRESH = "refresh"
    # Receive the canvas theme: its tokens, and light or dark mode.
    THEME = "theme"

    # A compute capability for WebAssembly, workers and ``eval`` is review
    # finding K1, pending; it is deliberately not part of this enum.
