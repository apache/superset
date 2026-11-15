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
The sandbox site in the host pages' Content Security Policy.

A host page shows an artifact's frame only if its policy allows the sandbox
site in ``frame-src``, and only the provider knows that site. The entry point
declares ``frame_csp_sources`` to the host (``add_csp_sources`` in
``superset_core.extensions.csp``), which asks it for each page it serves.
"""

from __future__ import annotations

from superset_core.artifacts.provider import FrameSources
from superset_core.extensions.csp import CspSources
from superset_oss.artifacts.errors import ArtifactError
from superset_oss.artifacts.gate import open_artifacts


def csp_sources_for(sandbox: FrameSources) -> CspSources:
    """What the host pages' policy must allow to show frames from ``sandbox``."""
    return {"frame-src": list(sandbox.frame_sources())}


def frame_csp_sources() -> CspSources:
    """
    The provider's frame sources while artifacts are on, and nothing otherwise.

    Off, no frame loads, so the host pages keep their policy as it is.
    """
    try:
        artifacts = open_artifacts()
    except ArtifactError:
        return {}
    return csp_sources_for(artifacts.provider)
