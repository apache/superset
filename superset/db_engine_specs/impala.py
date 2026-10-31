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

from __future__ import annotations

import logging
import re
import time
from collections.abc import Callable
from datetime import datetime
from typing import Any, Optional, TYPE_CHECKING

from flask import current_app as app
from sqlalchemy import text, types
from sqlalchemy.engine.reflection import Inspector

from superset import db
from superset.constants import QUERY_EARLY_CANCEL_KEY, TimeGrain
from superset.db_engine_specs.base import (
    BaseEngineSpec,
    DatabaseCategory,
    TIME_LIMIT_EXCEPTIONS,
)
from superset.models.sql_lab import Query
from superset.utils.core import QueryStatus
from superset.utils.hive import (
    guard_cursor,
    guard_cursor_factory,
    real_cursor,
    ThriftClientGuard,
)
from superset.utils.network import get_ssrf_safe_requester, is_safe_host

if TYPE_CHECKING:
    from superset.models.core import Database

logger = logging.getLogger(__name__)
# Query 5543ffdf692b7d02:f78a944000000000: 3% Complete (17 out of 547)
QUERY_PROGRESS_REGEX = re.compile(r"Query.*: (?P<query_progress>[0-9]+)%")


class ImpalaEngineSpec(BaseEngineSpec):
    """Engine spec for Cloudera's Impala"""

    engine = "impala"
    engine_name = "Apache Impala"
    # The engine's default text comparison is binary, so a mirrored
    # ``partition_col = T(v)`` agrees with the ``col = v`` it stands in for.
    binary_string_comparison = True

    # Epoch-integer partition keys are the common Impala layout, and the
    # one-argument form takes the bound being mirrored rather than "now".
    partition_value_transform_default = "unix_timestamp(:value)"

    metadata = {
        "description": (
            "Apache Impala is an open-source massively parallel "
            "processing SQL query engine."
        ),
        "logo": "apache-impala.png",
        "homepage_url": "https://impala.apache.org/",
        "categories": [
            DatabaseCategory.APACHE_PROJECTS,
            DatabaseCategory.QUERY_ENGINES,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["impyla"],
        "connection_string": "impala://{hostname}:{port}/{database}",
        "default_port": 21050,
    }

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.MINUTE: "TRUNC({col}, 'MI')",
        TimeGrain.HOUR: "TRUNC({col}, 'HH')",
        TimeGrain.DAY: "TRUNC({col}, 'DD')",
        TimeGrain.WEEK: "TRUNC({col}, 'WW')",
        TimeGrain.MONTH: "TRUNC({col}, 'MONTH')",
        TimeGrain.QUARTER: "TRUNC({col}, 'Q')",
        TimeGrain.YEAR: "TRUNC({col}, 'YYYY')",
    }

    has_query_id_before_execute = False

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "from_unixtime({col})"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: dict[str, Any] | None = None
    ) -> str | None:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"CAST('{dttm.date().isoformat()}' AS DATE)"
        if isinstance(sqla_type, types.TIMESTAMP):
            return f"""CAST('{dttm.isoformat(timespec="microseconds")}' AS TIMESTAMP)"""
        return None

    @classmethod
    def get_schema_names(cls, inspector: Inspector) -> set[str]:
        with inspector.engine.connect() as conn:
            return {
                row[0]
                for row in conn.execute(text("SHOW SCHEMAS"))
                if not row[0].startswith("_")
            }

    @classmethod
    def has_implicit_cancel(cls) -> bool:
        """
        Keep the HTTP cancel available to callers without a polling loop, such as
        chart and MCP cancellation. SQL Lab stops are routed to the live cursor by
        ``prepare_cancel_query``.
        """
        return False

    @classmethod
    @guard_cursor
    def execute(
        cls,
        cursor: Any,
        query: str,
        database: Database,
        **kwargs: Any,
    ) -> None:
        try:
            cursor.execute_async(query)
        except TIME_LIMIT_EXCEPTIONS:
            raise
        except Exception as ex:
            raise cls.get_dbapi_mapped_exception(ex) from ex

    @classmethod
    @guard_cursor
    def fetch_data(cls, cursor: Any, limit: int | None = None) -> list[tuple[Any, ...]]:
        """Wait for asynchronous operations using the public cursor API."""
        if callable(getattr(cursor, "execute_async", None)):
            from impala.error import Error

            deadline = time.monotonic() + app.config["SQLLAB_TIMEOUT"]
            try:
                while cursor.is_executing():
                    if time.monotonic() >= deadline:
                        cls._cancel_operation(cursor)
                        raise TimeoutError("Timed out waiting for the Impala operation")
                    time.sleep(0.1)
                if cursor.execution_failed():
                    # Fetching surfaces the driver's detailed asynchronous error,
                    # including errors on statements that produce no result set.
                    cursor.fetchall()
            except Error as ex:
                raise cls.get_dbapi_mapped_exception(ex) from ex
        return super().fetch_data(cursor, limit)

    @classmethod
    def prepare_connection(cls, connection: Any) -> None:
        """Guard OpenSession and all cursors sharing this connection's client."""
        service = connection.service
        if not isinstance(service.client, ThriftClientGuard):
            service.client = ThriftClientGuard(service.client)
        service.client.register(service, cls._abandon_service)
        guard_cursor_factory(connection, cls.prepare_cursor)

    @staticmethod
    def _abandon_service(service: Any) -> None:
        """Make connection close local-only and non-fatal after interruption."""
        transport = service.client._iprot.trans

        def close() -> None:
            try:
                transport.close()
            except (Exception, KeyboardInterrupt):  # pylint: disable=broad-except
                logger.warning("Dropping the interrupted Impala transport failed")

        service.close = close
        close()

    @classmethod
    def prepare_cursor(cls, cursor: Any) -> Callable[[BaseException], None] | None:
        """Cover lazy metadata and cleanup inside the driver, as well as rows."""
        cursor = real_cursor(cursor)
        session = getattr(cursor, "session", None)
        if session is None:
            return None
        service = session.service
        if not isinstance(service.client, ThriftClientGuard):
            service.client = ThriftClientGuard(service.client)
        guard = service.client
        session.client = guard
        if cursor._last_operation is not None:  # pylint: disable=protected-access
            cursor._last_operation.client = guard  # pylint: disable=protected-access
        guard.register(service, cls._abandon_service)
        guard.register(cursor, cls._abandon_cursor)
        return guard.abandon

    @classmethod
    def _abandon_cursor(cls, cursor: Any, query_id: int | None = None) -> None:
        """Send no further RPC on a transport that may hold an unread reply."""
        cursor = real_cursor(cursor)
        if (
            getattr(cursor, "_superset_abandoned", False) is True
            or getattr(cursor, "_closed", False) is True
        ):
            return
        cursor._superset_abandoned = True  # pylint: disable=protected-access
        # ``HiveServer2Cursor.close()``, which callers reach through
        # ``closing()``, and its finalizer send CloseOperation and CloseSession.
        # Both skip a cursor already marked closed. Wrappers such as SQL Lab's
        # row-limited cursor forward the attribute to the driver's cursor.
        cursor._closed = True  # pylint: disable=protected-access
        # Metadata reads after a Stop must not reach the abandoned operation,
        # even if its transport stack could not be recognised or dropped.
        cursor._last_operation_active = False  # pylint: disable=protected-access
        cursor._last_operation = None  # pylint: disable=protected-access
        cursor._description = None  # pylint: disable=protected-access
        # Discard any buffered reply before releasing the connection locally.
        try:
            cls._reset_transport(cursor, reconnect=False)
        except (Exception, KeyboardInterrupt):  # pylint: disable=broad-except
            # The closed flag is set before this best-effort, local cleanup.
            logger.warning("Query %s: dropping the transport failed", query_id)

    @classmethod
    def _reset_transport(cls, cursor: Any, reconnect: bool = True) -> bool:
        """
        Close the cursor's Thrift transport with every buffer emptied.

        impyla's ``reconnect()`` only closes and reopens the socket or HTTP
        connection, while the buffering layers above it keep their read and
        write buffers. Returns whether every layer was recognised and reset.

        With ``reconnect`` the transport is opened again. Without it a socket
        is left closed until impyla's next RPC opens it; an HTTP client is
        still reopened, which creates a connection object without network I/O,
        because closing it a second time raises.
        """
        # pylint: disable=import-outside-toplevel
        from io import BytesIO

        # The same transport object impyla's own ``reconnect()`` reopens.
        transport = cursor.session.service.client._iprot.trans
        stack = cls._transport_buffers(transport)
        if stack is None:
            if not reconnect:
                transport.close()
            return False
        buffers, over_socket = stack

        # Closing drops the socket together with any reply bytes still in it.
        try:
            transport.close()
        except TIME_LIMIT_EXCEPTIONS:
            raise
        except (Exception, KeyboardInterrupt):  # pylint: disable=broad-except
            # An HTTP client that was already closed raises on a second close.
            if transport.isOpen():
                raise
        for buffered_layer, attribute in buffers:
            setattr(buffered_layer, attribute, BytesIO())
        if reconnect or not over_socket:
            transport.open()
        return True

    @staticmethod
    def _transport_buffers(
        transport: Any,
    ) -> tuple[list[tuple[Any, str]], bool] | None:
        """
        List the buffers of every layer of an impyla transport stack.

        Returns the (layer, buffer attribute) pairs and whether the stack ends
        in a socket rather than an HTTP client, or None if a layer is not
        recognised.
        """
        # pylint: disable=import-outside-toplevel
        from impala._thrift_api import ImpalaHttpClient
        from thrift.transport.TSocket import TSocket
        from thrift.transport.TTransport import TBufferedTransport

        # (layer type, its buffer attributes, the attribute of the layer below).
        # The buffers are private to thrift, thrift_sasl and impyla, so the
        # whole stack is checked before anything is changed.
        layouts: list[tuple[type, tuple[str, ...], str | None]] = [
            (
                TBufferedTransport,
                ("_TBufferedTransport__rbuf", "_TBufferedTransport__wbuf"),
                "_TBufferedTransport__trans",
            ),
            # Each HTTP request opens a new connection; only the pending
            # request body is kept on the client.
            (ImpalaHttpClient, ("_ImpalaHttpClient__wbuf",), None),
        ]
        try:
            from thrift_sasl import TSaslClientTransport

            layouts.append(
                (
                    TSaslClientTransport,
                    ("_TSaslClientTransport__rbuf", "_TSaslClientTransport__wbuf"),
                    "_trans",
                )
            )
        except ImportError:
            pass

        buffers: list[tuple[Any, str]] = []
        layer = transport
        while not isinstance(layer, TSocket):
            layout = next((lay for lay in layouts if isinstance(layer, lay[0])), None)
            if layout is None:
                return None
            _, attributes, inner = layout
            if not all(hasattr(layer, attribute) for attribute in attributes):
                return None
            buffers.extend((layer, attribute) for attribute in attributes)
            if inner is None:
                return buffers, False
            layer = getattr(layer, inner, None)
        return buffers, True

    @staticmethod
    def _is_error_reply(ex: Exception) -> bool:
        """Whether ``ex`` reports an error reply that was read to its end."""
        # impyla raises HiveServer2Error for an error status, and Thrift raises
        # TApplicationException for an exception reply, each after reading the
        # whole reply. Any other failure, such as a dropped connection or a
        # reply that could not be parsed, can leave part of a reply unread.
        # pylint: disable=import-outside-toplevel
        reply_errors: list[type[Exception]] = []
        try:
            from impala.error import HiveServer2Error

            reply_errors.append(HiveServer2Error)
        except ImportError:
            pass
        try:
            from thrift.Thrift import TApplicationException

            reply_errors.append(TApplicationException)
        except ImportError:
            pass
        return isinstance(ex, tuple(reply_errors))

    @classmethod
    def _cancel_operation(cls, cursor: Any, query_id: int | None = None) -> None:
        """Cancel the live operation and release its handles."""
        # The handles are released even when the coordinator rejects the
        # cancel, so a stopped query does not leave an operation open on the
        # coordinator for the rest of the connection's life. A call that fails
        # without reading its whole reply leaves the transport unusable, so the
        # cursor is abandoned instead of reading the next reply from it.
        for name, rpc in (
            ("cancel_operation", cursor.cancel_operation),
            ("close_operation", cursor.close_operation),
            ("close", cursor.close),
        ):
            try:
                rpc()
            except TIME_LIMIT_EXCEPTIONS:
                # Also covers Stop and the local fetch deadline: their outer
                # time-limit handler must not retry this interrupted cleanup.
                cls._abandon_cursor(cursor, query_id)
                raise
            except Exception as ex:  # pylint: disable=broad-except
                logger.warning("Query %s: %s() failed", query_id, name)
                if not cls._is_error_reply(ex):
                    cls._abandon_cursor(cursor, query_id)
                    return

    @classmethod
    @guard_cursor
    def handle_cursor(cls, cursor: Any, query: Query) -> None:
        """Stop query and updates progress information"""

        query_id = query.id
        unfinished_states = (
            "PENDING_STATE",
            "INITIALIZED_STATE",
            "RUNNING_STATE",
        )
        # An operation waiting for admission often starts within moments, so it
        # is polled with a short interval that backs off to the configured one,
        # rather than holding a short query back for a full poll interval.
        pending_sleep_interval = 0.1

        try:
            status = cursor.status()
            while status in unfinished_states:
                # End the read transaction first. Under REPEATABLE READ, refreshing
                # inside one long transaction keeps returning the first snapshot,
                # so a Stop committed by another request would never be seen.
                db.session.commit()  # pylint: disable=consider-using-transaction
                db.session.refresh(query)
                # Stop was requested: either before a cancel handle was published
                # (early-cancel flag) or through SQL Lab's stop, which persists
                # STOPPED once cancel_query() succeeds.
                if (
                    query.extra.get(QUERY_EARLY_CANCEL_KEY)
                    or query.status == QueryStatus.STOPPED
                ):
                    cls._cancel_operation(cursor, query_id)
                    break

                sleep_interval = app.config["DB_POLL_INTERVAL_SECONDS"].get(
                    cls.engine, 5
                )
                # Pending/initialized operations have no execution progress yet.
                if status == "RUNNING_STATE":
                    try:
                        log = cursor.get_log() or ""
                    except TIME_LIMIT_EXCEPTIONS:
                        raise
                    except (Exception, KeyboardInterrupt):  # pylint: disable=broad-except
                        logger.warning("Call to GetLog() failed")
                        log = ""

                    if match := QUERY_PROGRESS_REGEX.match(log):
                        progress = int(match.groupdict()["query_progress"])
                        logger.debug("Query %s: Progress total: %s", query_id, progress)
                        if progress > query.progress:
                            query.progress = progress
                            db.session.commit()  # pylint: disable=consider-using-transaction
                else:
                    sleep_interval = min(pending_sleep_interval, sleep_interval)
                    pending_sleep_interval *= 2
                time.sleep(sleep_interval)
                status = cursor.status()
        except TIME_LIMIT_EXCEPTIONS:
            raise
        except (Exception, KeyboardInterrupt):  # pylint: disable=broad-except
            logger.debug("Call to status() failed ")
            return

    @classmethod
    def prepare_cancel_query(cls, query: Query) -> None:
        """
        Route a SQL Lab stop to the live cursor, whether or not the operation's
        cancel handle has been published.

        The early-cancel flag lets the stop succeed, and ``handle_cursor`` cancels
        the operation with ``cancel_operation()`` as soon as it polls. Cancelling
        through the coordinator's HTTP endpoint instead would invalidate the
        handle the worker is still polling, so the run fails with an unknown
        query handle error rather than ending as stopped.

        The stop caller commits STOPPED before preparing engine cancellation,
        and persists this flag afterwards through the guarded-stop protocol.
        Preparation must not commit or claim the stop a second time.

        Known gap: the stop only reaches Impala while a worker is polling the
        operation in ``handle_cursor``. The query is marked stopped, but Impala
        keeps running it and holds its admission slot until it finishes or
        Impala closes it on its own, when:

        - the worker has died or restarted;
        - the stop lands after polling ended, while ``fetch_data`` is reading
          results;
        - polling ended early because ``cursor.status()`` raised.

        Hive and Presto stop SQL Lab queries the same way. Chart and MCP
        cancellation still use the coordinator's HTTP endpoint through
        ``cancel_query``.
        """
        query.set_extra_json_key(QUERY_EARLY_CANCEL_KEY, True)

    @classmethod
    def get_cancel_query_id(cls, cursor: Any, query: Query) -> Optional[str]:
        """
        Get Impala Query ID that will be used to cancel the running
        queries to release impala resources.

        :param cursor: Cursor instance in which the query will be executed
        :param query: Query instance
        :return: Impala Query ID
        """
        last_operation = getattr(cursor, "_last_operation", None)
        if not last_operation:
            return None
        guid = last_operation.handle.operationId.guid[::-1].hex()
        return f"{guid[-16:]}:{guid[:16]}"

    @classmethod
    def cancel_query(cls, cursor: Any, query: Query, cancel_query_id: str) -> bool:
        """
        Cancel query in the underlying database.

        :param cursor: New cursor instance to the db of the query
        :param query: Query instance
        :param cancel_query_id: Impala query ID in format "hex:hex"
        :return: True if query cancelled successfully, False otherwise
        """
        # Validate cancel_query_id to prevent URL injection
        # Impala query IDs are in "hex:hex" form (16 hex chars per side)
        if not cls.validate_cancel_query_id(
            cancel_query_id, r"^[A-Fa-f0-9]{16}:[A-Fa-f0-9]{16}$"
        ):
            return False

        try:
            impala_host = query.database.url_object.host
            # The cancel call issues an outbound HTTP request from the
            # Superset backend to whatever host the DB connection was
            # configured with; validate it before the call to keep this
            # path consistent with the dataset-import and webhook URL
            # checks. Operators with internal Impala targets can opt out
            # via IMPALA_CANCEL_QUERY_ALLOW_INTERNAL_HOSTS.
            if not impala_host:
                return False
            if not app.config[
                "IMPALA_CANCEL_QUERY_ALLOW_INTERNAL_HOSTS"
            ] and not is_safe_host(impala_host):
                logger.warning(
                    "Impala cancel_query refused: target host is not allowed"
                )
                return False
            url = f"http://{impala_host}:25000/cancel_query?query_id={cancel_query_id}"
            # Do not follow redirects: a validated host could otherwise 30x the
            # request to an internal target, bypassing the is_safe_host check.
            # get_ssrf_safe_requester also re-validates the actually-connected
            # peer on this request, closing the DNS-rebinding/TOCTOU gap the
            # upfront is_safe_host check alone leaves open.
            requester = get_ssrf_safe_requester(
                allow_unsafe_hosts=app.config[
                    "IMPALA_CANCEL_QUERY_ALLOW_INTERNAL_HOSTS"
                ]
            )
            response = requester.post(url, timeout=3, allow_redirects=False)
        except (Exception, KeyboardInterrupt):  # pylint: disable=broad-except
            return False

        return bool(response and response.status_code == 200)
