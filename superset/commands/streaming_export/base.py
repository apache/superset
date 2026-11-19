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
"""Base command for streaming CSV exports."""

from __future__ import annotations

import codecs
import csv
import io
import logging
import time
from abc import abstractmethod
from contextvars import copy_context
from decimal import Decimal
from numbers import Real
from typing import Any, Callable, Generator, Iterable, Iterator, TypeVar

from flask import current_app as app, g
from flask.globals import _cv_app, _cv_request
from sqlalchemy import inspect, text
from sqlalchemy.orm import InstanceState
from werkzeug.local import LocalProxy

from superset import db
from superset.commands.base import BaseCommand
from superset.utils.csv import escape_value, format_decimal

logger = logging.getLogger(__name__)

_T = TypeVar("_T")


def _reload_if_detached(instance: _T) -> _T:
    """
    Return ``instance`` loaded again by primary key if it is a detached ORM
    instance, otherwise ``instance`` itself.

    The WSGI server only iterates a streaming body after the view has
    returned, and by then Flask has torn the request down, removing the
    metadata session that loaded the instance. Any attribute that session
    expired (the event logger commits once the view returns), even the
    primary key, would then raise ``DetachedInstanceError``.

    Reloading rather than merging means values read during the request are
    never written back over changes made since, by the commit that follows
    building the engine.
    """
    state = inspect(instance, raiseerr=False)
    if not isinstance(state, InstanceState) or not state.detached:
        return instance

    reloaded = db.session.get(state.class_, state.identity)
    if reloaded is None:
        # Fail closed: e.g. without the acting user, impersonation would fall
        # back to the connection's own credentials.
        raise RuntimeError(f"{state.class_.__name__} {state.identity} no longer exists")
    return reloaded


def _reload_detached_acting_user() -> None:
    """
    Point ``g.user`` at the acting user loaded again if it was detached.

    Users that are not ORM instances, such as embedded guest users, are left
    as they are.
    """
    user = getattr(g, "user", None)
    if isinstance(user, LocalProxy):
        # Flask-AppBuilder sets ``g.user`` to Flask-Login's ``current_user``.
        user = user._get_current_object()

    reloaded = _reload_if_detached(user)
    if reloaded is user:
        return
    g.user = reloaded
    if getattr(g, "_login_user", None) is user:
        # Keep Flask-Login's ``current_user`` on the same, reloaded user.
        g._login_user = reloaded


def encode_csv_stream(
    chunks: Iterable[str], encoding: str
) -> Generator[bytes, None, None]:
    """
    Encode streamed CSV chunks with the configured CSV_EXPORT encoding.

    Werkzeug encodes ``str`` chunks of a response body as plain UTF-8, which
    ignores the configured encoding. An incremental encoder is used so that
    codecs with a preamble, such as the default "utf-8-sig", write the byte
    order mark once at the start of the file rather than once per chunk.

    Args:
        chunks: CSV data chunks as strings
        encoding: Name of the codec to encode the chunks with

    Yields:
        Encoded CSV data chunks
    """
    encoder = codecs.getincrementalencoder(encoding)()
    for chunk in chunks:
        if data := encoder.encode(chunk):
            yield data
    if data := encoder.encode("", final=True):
        yield data


class BaseStreamingCSVExportCommand(BaseCommand):
    """
    Base class for streaming CSV export commands.

    Provides shared functionality for:
    - Generating CSV data in chunks
    - Managing database connections
    - Buffering data for efficient streaming
    - Error handling with user-friendly messages

    Subclasses must implement:
    - _get_sql_and_database(): Return SQL query string and database object
    - _get_row_limit(): Return optional row limit for the export
    """

    def __init__(self, chunk_size: int = 1000):
        """
        Initialize the streaming export command.

        Args:
            chunk_size: Number of rows to fetch per database query (default: 1000)
        """
        self._chunk_size = chunk_size

    @abstractmethod
    def _get_sql_and_database(self) -> tuple[str, Any, str | None, str | None]:
        """
        Get the SQL query, database, catalog, and schema for execution.

        The returned SQL is expected to already carry any
        ``is_split=False`` mutation applied upstream (e.g. by
        ``get_query_str_extended`` for charts, or SQL Lab's stored
        ``executed_sql``); ``run()`` applies the complementary
        ``is_split=True`` mutation exactly once before execution, so the
        mutator fires once total under either ``MUTATE_AFTER_SPLIT``
        setting.

        Returns:
            Tuple of (sql_query, database_object, catalog, schema)
        """

    @abstractmethod
    def _get_row_limit(self) -> int | None:
        """
        Get the row limit for the export.

        Returns:
            Row limit or None for unlimited
        """

    def _write_csv_header(
        self, columns: list[str], csv_writer: Any, buffer: io.StringIO
    ) -> tuple[str, int]:
        """Write CSV header and return header data with byte count."""
        # Mirror the non-streaming export path (df_to_escaped_csv): header
        # cells can carry attacker-influenced labels, so neutralize
        # spreadsheet formula prefixes here too.
        csv_writer.writerow(
            [
                escape_value(column) if isinstance(column, str) else column
                for column in columns
            ]
        )
        header_data = buffer.getvalue()
        total_bytes = len(header_data.encode("utf-8"))
        buffer.seek(0)
        buffer.truncate()
        return header_data, total_bytes

    def _format_row_values(
        self, row: tuple[Any, ...], decimal_separator: str | None
    ) -> list[Any]:
        """
        Format row values: escape string cells against CSV formula injection
        and apply the custom decimal separator if specified.

        Args:
            row: Database row as a tuple
            decimal_separator: Custom decimal separator (e.g., ",") or None

        Returns:
            List of formatted values
        """
        active_decimal_separator = (
            decimal_separator
            if decimal_separator and decimal_separator != "."
            else None
        )

        formatted: list[Any] = []
        for value in row:
            # Escape string cells so spreadsheet formula prefixes (= + - @ |,
            # leading tab/CR) are neutralized, mirroring the non-streaming
            # CSV path (superset.utils.csv.df_to_escaped_csv).
            if isinstance(value, str):
                formatted.append(escape_value(value))
            # Apply the custom decimal separator to any real numeric value
            # (float, decimal.Decimal, numpy numeric types, ...). Booleans are
            # technically a numeric type in Python but should never be rewritten
            # as numbers in CSV output.
            elif isinstance(value, Decimal):
                decimal_value = format_decimal(value)
                if active_decimal_separator is not None:
                    decimal_value = str(decimal_value).replace(
                        ".", active_decimal_separator
                    )
                formatted.append(decimal_value)
            elif isinstance(value, bool):
                formatted.append(value)
            elif active_decimal_separator is not None and isinstance(
                value, (float, Real)
            ):
                # Format numeric values with custom decimal separator
                formatted.append(str(value).replace(".", active_decimal_separator))
            else:
                formatted.append(value)
        return formatted

    def _process_rows(
        self,
        result_proxy: Any,
        csv_writer: Any,
        buffer: io.StringIO,
        limit: int | None,
        decimal_separator: str | None = None,
    ) -> Generator[tuple[str, int, int], None, None]:
        """
        Process database rows and yield CSV data chunks.

        Args:
            result_proxy: SQLAlchemy result proxy
            csv_writer: CSV writer instance
            buffer: StringIO buffer for CSV data
            limit: Maximum number of rows to process, or None for unlimited
            decimal_separator: Custom decimal separator (e.g., ",") or None

        Yields tuples of (data_chunk, row_count, byte_count).
        """
        row_count = 0
        flush_threshold = 65536  # 64KB

        while rows := result_proxy.fetchmany(self._chunk_size):
            for row in rows:
                # Apply limit if specified
                if limit is not None and row_count >= limit:
                    break

                # Format values with custom decimal separator if needed
                formatted_row = self._format_row_values(row, decimal_separator)
                csv_writer.writerow(formatted_row)
                row_count += 1

                # Check buffer size and flush if needed
                current_size = buffer.tell()
                if current_size >= flush_threshold:
                    data = buffer.getvalue()
                    data_bytes = len(data.encode("utf-8"))
                    yield data, row_count, data_bytes
                    buffer.seek(0)
                    buffer.truncate()

            # Break outer loop if limit reached
            if limit is not None and row_count >= limit:
                break

        # Flush remaining buffer
        if remaining_data := buffer.getvalue():
            data_bytes = len(remaining_data.encode("utf-8"))
            yield remaining_data, row_count, data_bytes

    def _execute_query_and_stream(
        self,
        sql: str,
        database: Any,
        limit: int | None,
        catalog: str | None = None,
        schema: str | None = None,
    ) -> Generator[str, None, None]:
        """Execute query with streaming and yield CSV chunks."""
        start_time = time.time()
        total_bytes = 0

        # Get CSV export configuration. CSV_EXPORT has an explicit default in
        # config.py, so index directly rather than using .get() with a hardcoded
        # fallback that would silently mask a misconfiguration removing the key.
        #
        # The streaming path only honors the `sep` and `decimal` keys from
        # CSV_EXPORT. Unlike the non-streaming path in
        # superset.charts.client_processing (which builds the whole file with a
        # single DataFrame.to_csv(**CSV_EXPORT) call), this path writes rows
        # incrementally via csv.writer, so the remaining pandas to_csv kwargs
        # (e.g. quotechar, lineterminator) do not map onto it and are
        # intentionally not applied here. The `encoding` key is applied by the
        # API layer when it encodes the streamed chunks (see encode_csv_stream).
        csv_export_config = app.config["CSV_EXPORT"]
        delimiter = csv_export_config.get("sep", ",")
        decimal_separator = csv_export_config.get("decimal", ".")

        with db.session() as session:
            # Load the database again rather than merging it, see
            # _reload_if_detached.
            merged_database = _reload_if_detached(database)

            # `is_split=True` mirrors the non-streaming download path exactly:
            # Database.get_df() -> _execute_sql_with_mutation_and_logging()
            # always calls mutate_sql_based_on_config(..., is_split=True) on
            # SQL Lab's stored select_sql/executed_sql, and the chart query
            # path applies its own mutation upstream (in
            # get_query_str_extended, with is_split=False) before landing
            # here. Since `is_split` and `MUTATE_AFTER_SPLIT` are compared
            # for equality, `is_split=True` is the complement of that
            # upstream chart mutation -- together they mutate the SQL
            # exactly once for either MUTATE_AFTER_SPLIT setting, instead of
            # double-mutating when it's False and never mutating when it's
            # True.
            mutated_sql = merged_database.mutate_sql_based_on_config(sql, is_split=True)

            with merged_database.get_sqla_engine(
                catalog=catalog, schema=schema
            ) as engine:
                # Building the engine may have refreshed the user's OAuth2
                # token, which is only staged on the session. Commit it, as the
                # buffered export's query logging does, instead of losing it
                # when the session closes (a single-use refresh token would be
                # spent), and so no metadata transaction is held open while the
                # rows stream.
                session.commit()  # pylint: disable=consider-using-transaction
                with engine.connect() as connection:
                    result_proxy = connection.execution_options(
                        stream_results=True
                    ).execute(text(mutated_sql))

                    columns = list(result_proxy.keys())

                    # Use StringIO with csv.writer for proper escaping
                    # Apply delimiter from CSV_EXPORT config
                    buffer = io.StringIO()
                    csv_writer = csv.writer(
                        buffer, delimiter=delimiter, quoting=csv.QUOTE_MINIMAL
                    )

                    # Write CSV header
                    header_data, header_bytes = self._write_csv_header(
                        columns, csv_writer, buffer
                    )
                    total_bytes += header_bytes
                    yield header_data

                    # Process rows and yield chunks
                    row_count = 0
                    for data_chunk, rows_processed, chunk_bytes in self._process_rows(
                        result_proxy, csv_writer, buffer, limit, decimal_separator
                    ):
                        total_bytes += chunk_bytes
                        row_count = rows_processed
                        yield data_chunk

                    # Log completion
                    total_time = time.time() - start_time
                    total_mb = total_bytes / (1024 * 1024)
                    logger.info(
                        "Streaming CSV completed: %s rows, %.1fMB in %.2fs",
                        f"{row_count:,}",
                        total_mb,
                        total_time,
                    )

    def run(self) -> Callable[[], Iterator[str]]:
        """
        Execute the streaming CSV export.

        Returns:
            A callable that returns an iterator yielding CSV data chunks as
            strings. Call it while handling the request: the iterator then
            runs the export inside that request's context, even though the
            body is only streamed once the view has returned. Outside a
            request, consume the iterator inside the caller's app context;
            it then runs as the caller's ``g.user`` (set it with
            ``override_user``).
        """
        # Load all needed data while session is still active
        # to avoid DetachedInstanceError
        sql, database, catalog, schema = self._get_sql_and_database()
        limit = self._get_row_limit()

        def csv_generator() -> Generator[str, None, None]:
            """Generator that yields CSV data chunks."""
            try:
                _reload_detached_acting_user()
                yield from self._execute_query_and_stream(
                    sql, database, limit, catalog, schema
                )
            except Exception as e:
                logger.error("Error in streaming CSV generator: %s", e)
                import traceback

                logger.error("Traceback: %s", traceback.format_exc())

                # Send error marker for frontend to detect
                error_marker = (
                    "__STREAM_ERROR__:Export failed. Please try again in some time.\n"
                )
                yield error_marker

        def stream() -> Iterator[str]:
            """
            Return the CSV iterator, bound to the current request if any.

            The export runs inside the request it belongs to, as the buffered
            export does, not merely inside an app context. Code on the
            connection path depends on it: Snowflake only uses the user's
            OAuth2 token inside a request, the OAuth2 redirect URI may be
            built from it, and the query source passed to
            DB_CONNECTION_MUTATOR is read from it.

            The request's contexts are recorded here and pushed again only
            while the body is iterated, as ``flask.stream_with_context`` does
            from Flask 3.1.2. Pushing them up front, as older releases do,
            leaves them on the worker thread when the response never reaches
            the server (e.g. an ``after_request`` hook fails), and later
            requests on that thread would inherit this one's ``g`` and user.
            """
            request_context = _cv_request.get(None)
            if request_context is None:
                return csv_generator()
            app_context = _cv_app.get()

            def in_request() -> Generator[str, None, None]:
                if _cv_request.get(None) is request_context:
                    # Pulled while the request is still being handled: its
                    # contexts are already active, and pushing them again here
                    # would leave a token Flask's own pop can't reset.
                    yield from csv_generator()
                    return
                with app_context, request_context:
                    yield from csv_generator()

            def csv_generator_in_request() -> Generator[str, None, None]:
                # Step the export in a contextvars Context of its own, so the
                # request's contexts are only ever pushed there, never on the
                # worker thread: a body the server abandons mid-stream (e.g.
                # an error raised while encoding keeps it alive on a
                # traceback) or closes from another thread can't leave them
                # behind for the thread's next request to inherit.
                context = copy_context()
                inner = in_request()
                try:
                    while True:
                        try:
                            chunk = context.run(next, inner)
                        except StopIteration:
                            return
                        yield chunk
                finally:
                    context.run(inner.close)

            return csv_generator_in_request()

        return stream
