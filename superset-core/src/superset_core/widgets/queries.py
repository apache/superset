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
A widget's named queries, whose results are its datasets.

As SIP-231 has it, a widget type builds its queries from a widget's props
(``Widget.build_queries``), and the host runs them all for one data request
and answers each result as the dataset of the query's name. Until widgets
query through ``SemanticQuery``, a query is a binding: the dataset, metrics,
dimensions, filters and row limit of a placement's ``dataBinding``. By default
a widget has one query, its props' ``dataBinding``, named ``main``; a widget
type whose queries aren't in its props, such as one whose props only refer to
a file, builds its own.

The host checks and runs a query that a widget type builds exactly as one from
the props: as the caller, with their dataset access, row level security and
the runtime filters, which narrow every query. A widget type decides what its
widgets query, never who may read their data.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class QueryRequest:
    """A widget whose data the host serves, and where the host read it."""

    # The canvas, by id or UUID, and the placement the data request names;
    # ``None`` for a saved widget asked for on its own, without a canvas.
    canvas_id: str | None
    placement_id: str | None
    # The widget's props, as stored where the host read them.
    props: Mapping[str, Any]
    # The caller's draft of the canvas, when the host read the placement from
    # it. The host has checked that the draft is the caller's own, and that
    # they may edit the canvas.
    draft_token: str | None = None
    # The UUID of the saved widget the placement shows, when it shows one.
    widget_id: str | None = None


@dataclass(frozen=True)
class WidgetQuery:
    """One of a widget's queries; its result is the dataset of its name."""

    name: str
    # In the shape of a placement's ``dataBinding``. One that names no dataset
    # isn't bound yet, and the host leaves it out.
    binding: Mapping[str, Any]
