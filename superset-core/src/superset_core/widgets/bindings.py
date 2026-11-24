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
The bindings a widget type builds for a data request, whose results are the
widget's datasets.

A widget's data is queried on the server: by default the host runs the props'
``dataBinding`` as the dataset ``main``. A widget type whose data isn't in its
props, such as one whose props only refer to content stored elsewhere, builds
its bindings itself (``Widget.build_bindings``), and the host answers each as
the dataset of its name. A binding has the shape of a ``dataBinding``: a
dataset, its metrics, dimensions, filters, sort and row limit.

This is a stand-in, not SIP-231's query API. That one has widgets build
``WidgetQuery`` objects around a ``SemanticQuery`` from a semantic view and
the props (``QueryMixin.build_queries``); these names stay clear of it, so it
can land with its own shape.

The host checks every binding a type builds as it checks a stored one when it
is written, then runs it as the caller, with their dataset access, row level
security and the runtime filters, which narrow every binding on its dataset:

- the binding must be a valid ``dataBinding``, with a plain integer
  ``datasetId``;
- the caller must be able to read its dataset;
- names are unique, as each is a dataset of the answer;
- the host caps how many bindings one request runs
  (``CANVAS_WIDGET_MAX_BINDINGS``), and its row limits clamp a binding's own.

A binding that names no dataset isn't bound yet, and the host leaves it out.
A widget type decides what its widgets query, never who may read their data.

A widget type may also refuse a data request (``WidgetDataRefusedError``),
such as one that names content the widget no longer serves; the host then
answers with the type's code and message instead of any dataset.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class BindingRequest:
    """
    A data request for a widget: where the host read the widget, all of which
    the host has checked the caller may read. The caller's only input is the
    runtime filters, which the host applies to the bindings a type builds.
    """

    # The canvas, by id or UUID, and the placement the data request names;
    # ``None`` for a saved widget asked for on its own, without a canvas.
    canvas_id: str | None
    placement_id: str | None
    # The widget's props, as stored where the host read them.
    props: Mapping[str, Any]
    # The UUID of the saved widget the placement shows, when it shows one.
    widget_id: str | None = None
    # The caller's draft of the canvas, when the host read the placement from
    # it. The host has checked that the draft is the caller's own, and that
    # they may still edit the canvas.
    canvas_draft_token: str | None = None
    # The UUID of the saved version of the canvas the host read the placement
    # from, when the request previews one, as the canvas page names it in
    # ``X-Canvas-Version``. Only the canvas's editors can read a version, and
    # the host has checked that the caller is one. ``None`` when no version is
    # previewed, or when the placement came from the caller's draft, which
    # wins over a version.
    canvas_version: str | None = None


@dataclass(frozen=True)
class WidgetBinding:
    """One of a widget's bindings; its result is the dataset of its name."""

    name: str
    # In the shape of a placement's ``dataBinding``.
    binding: Mapping[str, Any]


class WidgetDataRefusedError(Exception):
    """
    A widget type's refusal of a data request: the host runs none of the
    widget's bindings and answers with ``code`` and ``message`` as they are,
    over HTTP with ``status``.

    ``code`` is for programs, such as the widget's renderer deciding what to
    do next. ``message`` reaches whoever made the request, so it must say
    nothing they may not know. ``status`` is a client error, by default 409
    for a request that names what the widget no longer serves, but not 401
    or 407: the frontend answers a 401 by sending the person to sign in.
    """

    def __init__(self, code: str, message: str, status: int = 409) -> None:
        if not isinstance(code, str) or not code:
            raise ValueError("a widget data refusal needs a code")
        if not 400 <= status < 500 or status in {401, 407}:
            raise ValueError(f"a widget data refusal can't answer {status}")
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
