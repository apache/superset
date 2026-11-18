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
Named data bindings that a widget type looks up itself.

A placement's data comes from a binding: the dataset, metrics, dimensions,
filters and row limit that the server queries as the caller. A placement's
props usually hold its bindings, the default one as ``dataBinding`` and the
named ones under ``bindings``. A widget type whose named bindings live
elsewhere, such as in a file its props only refer to, sets
``Widget.binding_resolver`` to look one up by name.

The host checks and runs a binding that a resolver answers exactly as one from
the props: as the caller, with their dataset access, row level security and
the runtime filters. A resolver decides which binding a name means, never who
may read its data.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class BindingRequest:
    """A named binding asked of a placement, and where the host read it."""

    # The canvas, by id or UUID, as the data request names it.
    canvas_id: str
    placement_id: str
    # The placement's props, as stored where the host read the placement.
    props: Mapping[str, Any]
    name: str
    # The caller's draft of the canvas, when the host read the placement from
    # it. The host has checked that the draft is the caller's own, and that
    # they may edit the canvas.
    draft_token: str | None = None
    # The UUID of the saved widget the placement shows, when it shows one.
    widget_id: str | None = None


# Answers binding ``name`` in the shape of a placement's ``dataBinding``, or
# ``None`` when the placement has no binding of that name for the caller; the
# host answers that as a placement without the binding. It raises only when
# the lookup itself fails.
BindingResolver = Callable[[BindingRequest], dict[str, Any] | None]
