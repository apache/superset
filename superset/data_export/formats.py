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
The file a full export is written as, and how it is written.

Both formats stream: the rows are pulled from the warehouse in batches and
appended to a file on disk, so a worker's memory does not grow with the size
of the result. The difference is only what the rows are turned into.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any, Callable, Sequence, TYPE_CHECKING

from flask import current_app
from flask_babel import lazy_gettext as _

from superset.commands.streaming_export.base import encode_csv_stream
from superset.exceptions import SupersetException
from superset.utils.excel_streaming import StreamingXlsxWriter

if TYPE_CHECKING:
    from superset.data_export.sources import FullExportSource

logger = logging.getLogger(__name__)

FORMAT_CSV = "csv"
FORMAT_XLSX = "xlsx"

XLSX_MIMETYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def csv_encoding() -> str:
    return current_app.config["CSV_EXPORT"].get("encoding", "utf-8")


def _write_csv(source: FullExportSource, path: str) -> None:
    """Write the export as CSV.

    The chunks are encoded with the configured ``CSV_EXPORT`` encoding, the
    same way the response-bound streaming export encodes them, so a codec with
    a preamble (the default ``utf-8-sig``) writes its byte order mark once at
    the start of the file.
    """
    stream = source.command.run()
    with open(path, "wb") as handle:
        for chunk in encode_csv_stream(stream(), csv_encoding()):
            handle.write(chunk)


def _write_xlsx(source: FullExportSource, path: str) -> None:
    """Write the export as a single ``.xlsx`` workbook.

    A worksheet holds just over a million rows, so an uncapped export spills
    onto continuation sheets rather than stopping at the limit -- the whole
    point is that the file holds every row.
    """
    rows: Iterator[Sequence[Any]] = source.command.run_rows()()
    columns = next(rows, None)
    if columns is None:
        # The row stream always yields a header first; reaching this means the
        # query produced no result set at all, which is not something to paper
        # over with an empty workbook.
        raise SupersetException("The query returned no result set to export.")

    writer = StreamingXlsxWriter(path)
    try:
        written = writer.add_rolling_sheets(source.label, columns, rows)
    finally:
        writer.close()
    if writer.sheet_count > 1:
        logger.info(
            "Full export of %s rows spilled onto %s sheets",
            f"{written:,}",
            writer.sheet_count,
        )


@dataclass(frozen=True)
class ExportFormat:
    """One format a full export can be delivered in."""

    name: str
    extension: str
    # Served on the download, so the browser opens the file as what it is.
    mimetype: str
    # Names the format in the email's download button.
    label: Any
    write: Callable[[FullExportSource, str], None]


FORMATS: dict[str, ExportFormat] = {
    FORMAT_CSV: ExportFormat(
        name=FORMAT_CSV,
        extension="csv",
        # The charset is appended per export, from CSV_EXPORT.
        mimetype="text/csv",
        label=_("CSV"),
        write=_write_csv,
    ),
    FORMAT_XLSX: ExportFormat(
        name=FORMAT_XLSX,
        extension="xlsx",
        mimetype=XLSX_MIMETYPE,
        label=_("Excel"),
        write=_write_xlsx,
    ),
}


def resolve_format(name: str | None) -> ExportFormat:
    """The format ``name`` asks for, defaulting to CSV.

    :raises SupersetException: for a name this version does not know, so a job
        left in the broker by another release fails loudly rather than being
        written as something the requester did not ask for
    """
    export_format = FORMATS.get(name or FORMAT_CSV)
    if export_format is None:
        raise SupersetException(f"Unknown full export format: {name}")
    return export_format


def content_type(export_format: ExportFormat) -> str:
    """The media type to serve the finished file under."""
    if export_format.name == FORMAT_CSV:
        return f"{export_format.mimetype}; charset={csv_encoding()}"
    return export_format.mimetype
