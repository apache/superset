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
A frame's context: where it may be shown, and what it is granted.

The grant is what the manifest declares, cut to what the context allows. The
allowed parents are the origin of the Superset page that asked for the link,
taken from the server's view of the request and never from the request body.
"""

# TODO: embedded contexts add the embedding's allowed domains to the allowed
# parents, and filters and cross-filters in embedded canvases.
# TODO: the host page's frame-src must allow exactly the provider's sandbox
# origin; extensions can't declare the CSP sources they need yet.

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Any
from urllib.parse import urlsplit

from superset_artifacts_sdk.capabilities import Capability
from superset_artifacts_sdk.manifest import ArtifactManifest
from superset_artifacts_sdk.provider import FrameContext, FrameMode

# What each context allows at most. A standalone or embedded page has no
# canvas whose widgets could follow a cross-filter.
_OFF_CANVAS = frozenset(c for c in Capability if c is not Capability.CROSS_FILTER)
CONTEXT_CAPABILITIES: Mapping[FrameMode, frozenset[Capability]] = MappingProxyType(
    {
        "canvas": frozenset(Capability),
        "standalone": _OFF_CANVAS,
        "embedded": _OFF_CANVAS,
    }
)


def grant_for(manifest: ArtifactManifest, mode: FrameMode) -> frozenset[Capability]:
    """The capabilities a frame gets: declared, and allowed in ``mode``."""
    return frozenset(manifest.capabilities) & CONTEXT_CAPABILITIES[mode]


def origin_of(url: str) -> str:
    """The origin (``scheme://host[:port]``) of an http or https URL."""
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise ValueError(f"{url!r} has no http or https origin")
    host = f"[{parts.hostname}]" if ":" in parts.hostname else parts.hostname
    return f"{parts.scheme}://{host}" + (f":{parts.port}" if parts.port else "")


def frame_context(
    mode: FrameMode, manifest: ArtifactManifest, host_url: str
) -> FrameContext:
    """The context to mint a frame link for: its only parent is the host page."""
    return FrameContext(
        mode=mode,
        allowed_parents=(origin_of(host_url),),
        capabilities=grant_for(manifest, mode),
    )


def host_manifest(manifest: ArtifactManifest) -> dict[str, Any]:
    """
    What the frame host checks each request against before acting on it.

    The frame host is the renderer, in the viewer's page; the server still
    builds every query from the stored manifest.
    """
    return manifest.model_dump(
        mode="json",
        include={"title", "bindings", "events", "capabilities"},
        exclude_none=True,
    )
