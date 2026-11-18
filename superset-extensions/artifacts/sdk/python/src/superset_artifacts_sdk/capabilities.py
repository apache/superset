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

An artifact lists the capabilities it needs in its manifest. The host grants
the ones its policy allows in the context it renders the artifact in (a
canvas, an embedded page, a standalone page), and passes that grant to the
frame: manifest ∩ policy ∩ context (``superset_artifacts_sdk.policy``). Both
sides check the grant; the host's check is the authoritative one, because the
frame runs untrusted code.

A capability is a namespaced string, and an unknown one fails validation, so
that new namespaces can come later without widening anything today.
"""

from __future__ import annotations

from enum import StrEnum


class Capability(StrEnum):
    """A named right that an artifact must declare in its manifest and be granted."""

    # Receive the results of the manifest's named bindings and the filters
    # that reach the artifact, and run bindings again: one with new values
    # for its declared parameters, or all of them.
    DATA = "data"
    # Set cross-filters, on declared events, that the other widgets on the
    # canvas follow.
    CROSS_FILTER = "cross_filter"
    # Receive the canvas theme: its tokens, and light or dark mode.
    THEME = "theme"
    # Compile and run WebAssembly: the frame's policy allows
    # 'wasm-unsafe-eval', and still no network.
    COMPUTE_WASM = "compute.wasm"
    # Start workers from blob: URLs, and still no network.
    COMPUTE_WORKERS = "compute.workers"
