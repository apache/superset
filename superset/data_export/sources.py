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
The two things a full export can export, behind one interface.

A queued export carries only JSON through the broker, so each kind is
rebuilt from that payload *inside the worker*, under the requesting user:
the SQL is generated there, which is what makes the export observe their
dataset access and row-level security rather than whoever's identity
happened to serialize it.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable

from flask_babel import gettext as __

from superset.commands.chart.data.streaming_export_command import (
    StreamingCSVExportCommand,
)
from superset.commands.sql_lab.streaming_export_command import (
    FullStreamingSqlResultExportCommand,
)
from superset.commands.streaming_export.base import BaseStreamingCSVExportCommand
from superset.common.query_serialization import load_serialized_query
from superset.exceptions import SupersetException
from superset.utils.file import get_filename

logger = logging.getLogger(__name__)

KIND_CHART = "chart"
KIND_QUERY = "query"
KINDS = (KIND_CHART, KIND_QUERY)

ProgressCallback = Callable[[int, int], None]


@dataclass
class FullExportSource:
    """One resolved export: how to run it, and how to describe it."""

    kind: str
    # Name of the chart or query, shown in the email and the file name.
    label: str
    # The command that streams the rows, with Superset's row cap removed.
    command: BaseStreamingCSVExportCommand
    # Identifying fields recorded in the audit log alongside the row count.
    audit: dict[str, Any] = field(default_factory=dict)

    @property
    def filename(self) -> str:
        """The name the browser saves the file under, without an extension.

        ``get_filename`` falls back to the model id when nothing
        filesystem-safe survives sanitizing the name. A full export has no id
        to show, so it passes 0 and reads that back as "no usable name".
        """
        name = get_filename(self.label, 0, skip_id=True)
        return self.kind if name == "0" else name


def _chart_source(
    payload: dict[str, Any],
    chunk_size: int,
    progress_callback: ProgressCallback,
) -> FullExportSource:
    """Rebuild a chart export from its serialized query context.

    The payload is a :func:`superset.common.query_serialization.serialize_query`
    product whose ``row_limit`` the API set to ``None``, so the query object
    this rebuilds carries no limit and the SQL it generates has no ``LIMIT``
    clause.
    """
    query_context = load_serialized_query(payload["query_context"])
    if query_context.queries[0].row_limit is not None:
        # The whole point of the export. A limit surviving here means the
        # payload lost ``preserve_null_row_limit`` on the way through the
        # broker, and the file would silently stop at that many rows.
        raise SupersetException(
            "A full chart export was queued with a row limit still applied "
            f"({query_context.queries[0].row_limit})."
        )
    return FullExportSource(
        kind=KIND_CHART,
        label=payload.get("label") or __("Chart"),
        command=StreamingCSVExportCommand(
            query_context,
            chunk_size,
            progress_callback=progress_callback,
            raise_on_error=True,
        ),
        audit={
            "slice_id": payload.get("slice_id"),
            "datasource_type": payload["query_context"]["datasource"].get("type"),
            "datasource_id": payload["query_context"]["datasource"].get("id"),
        },
    )


def _query_source(
    payload: dict[str, Any],
    chunk_size: int,
    progress_callback: ProgressCallback,
) -> FullExportSource:
    """Rebuild a SQL Lab export from its query's client id."""
    return FullExportSource(
        kind=KIND_QUERY,
        label=payload.get("label") or __("SQL Lab query"),
        command=FullStreamingSqlResultExportCommand(
            payload["client_id"],
            chunk_size,
            progress_callback=progress_callback,
            raise_on_error=True,
        ),
        audit={"client_id": payload["client_id"]},
    )


_RESOLVERS: dict[str, Callable[..., FullExportSource]] = {
    KIND_CHART: _chart_source,
    KIND_QUERY: _query_source,
}


def resolve_source(
    kind: str,
    payload: dict[str, Any],
    chunk_size: int,
    progress_callback: ProgressCallback,
) -> FullExportSource:
    """Rebuild the export ``kind`` describes from its queued ``payload``.

    :raises SupersetException: for a kind this version does not know, so a job
        left in the broker by an older or newer release fails loudly
    """
    if (resolver := _RESOLVERS.get(kind)) is None:
        raise SupersetException(f"Unknown full export kind: {kind}")
    return resolver(payload, chunk_size, progress_callback)
