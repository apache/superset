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
Tests db_engine_specs.mysql against a real MySQL instance, spun up on
demand via testcontainers. Run via .github/workflows/testcontainers.yml.

Plain MySQL itself was never covered by this suite: MariaDB and StarRocks
both reuse `MySQLEngineSpec`'s plain "mysql" dialect via mysqlclient, but
neither stands in for vanilla MySQL server's own dialect quirks.

Could not be verified locally in this environment: mysqlclient (MySQLdb)
has a pre-existing, unrelated native-library linking issue against this
machine's Homebrew-installed libmysqlclient. CI installs it via apt on
Linux, where this does not occur.

Also covers `require_mysql_tls` (apache/superset#44723): mysqlclient maps
`ssl_mode=REQUIRED` to *opportunistic* TLS when linked against MariaDB
Connector/C (CI's apt-installed mysqlclient links Oracle libmysqlclient
instead, so the `VERIFY_CA` branch is only exercised on MariaDB-linked
builds), meaning a server that offers no TLS at all is silently accepted
in cleartext rather than rejected -- the exact failure mode the fix exists
to close by substituting `VERIFY_CA` for that client library. A mocked
cursor can't observe this: the behavior lives in the C client library's
own TLS negotiation, decided once, at real connection time, against a real
server's real TLS posture. Two containers are used because the property
under test is two-sided: a `--ssl=0` server must make the connection fail
rather than silently downgrade (`test_require_mysql_tls_fails_closed...`),
while the default, TLS-capable server must still let a legitimate
encrypted connection through (`test_require_mysql_tls_connects_with...`)
-- a fix that merely refused every connection would pass the first check
and hide behind it.
"""

import tempfile
from collections.abc import Iterator
from typing import Any

import pytest
from sqlalchemy import (
    Column,
    create_engine,
    inspect,
    Integer,
    MetaData,
    Table as SATable,
    text,
)
from sqlalchemy.engine import Engine
from sqlalchemy.engine.url import make_url, URL
from sqlalchemy.exc import OperationalError

from superset.db_engine_specs.mysql import MySQLEngineSpec
from superset.sql.parse import Table
from superset.utils.core import GenericDataType

pytestmark = pytest.mark.testcontainers

from ._driver import require_driver  # noqa: E402

require_driver("testcontainers.community.mysql")

from testcontainers.community.mysql import MySqlContainer  # noqa: E402

from ._pagination import (  # noqa: E402
    assert_paginated_query_returns_correct_rows_in_order,
)


def _tcp_host(container: MySqlContainer) -> str:
    """Resolve a host MySQLdb will actually reach over TCP.

    get_connection_url() has no host override and defaults to
    get_container_host_ip(), which is the literal string "localhost" on
    native Linux Docker (e.g. GitHub Actions runners). MySQLdb (mysqlclient)
    treats a "localhost" host specially and attempts a Unix socket
    connection instead of TCP, which fails since there's no local MySQL
    socket -- the container is reached over the network. Only rewrite that
    specific local case to 127.0.0.1; a remote Docker daemon reports its own
    real host/IP here, which must be preserved so the suite can still reach
    it.
    """
    host = container.get_container_host_ip()
    return "127.0.0.1" if host == "localhost" else host


@pytest.fixture(scope="module")
def mysql_container() -> Iterator[MySqlContainer]:
    with MySqlContainer("mysql:8.0") as container:
        yield container


@pytest.fixture(scope="module")
def engine(mysql_container: MySqlContainer) -> Engine:
    host = _tcp_host(mysql_container)
    port = mysql_container.get_exposed_port(mysql_container.port)
    return create_engine(
        f"mysql://{mysql_container.username}:{mysql_container.password}"
        f"@{host}:{port}/{mysql_container.dbname}"
    )


def test_paginated_query_returns_correct_rows_in_order(engine: Engine) -> None:
    """
    A plain SQLAlchemy Core LIMIT/OFFSET query, compiled and executed against
    a real instance. Mocked tests cannot catch a dialect compiling this
    incorrectly (see apache/superset#42899, where Trino emitted OFFSET
    before LIMIT) -- only real execution can.
    """
    assert_paginated_query_returns_correct_rows_in_order(engine)


def test_get_columns_maps_native_types(engine: Engine) -> None:
    """
    MySQLEngineSpec.get_columns wraps a real SQLAlchemy Inspector; this
    exercises that against actual server-reported column metadata rather
    than a mocked Inspector.
    """
    metadata = MetaData()
    SATable(
        "pilot_types",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("amount", Integer),
    )
    metadata.create_all(engine)

    inspector = inspect(engine)
    columns = MySQLEngineSpec.get_columns(inspector, Table("pilot_types"))

    by_name = {col["column_name"]: col for col in columns}
    assert set(by_name) == {"id", "amount"}
    for col in by_name.values():
        spec = MySQLEngineSpec.get_column_spec(str(col["type"]))
        assert spec is not None
        assert spec.generic_type == GenericDataType.NUMERIC
        assert isinstance(spec.sqla_type, Integer)


@pytest.fixture(scope="module")
def no_tls_container() -> Iterator[MySqlContainer]:
    """A server with TLS fully disabled, to test the fail-closed guarantee.

    `--ssl=0` is MySQL's deprecated-but-still-supported spelling for turning
    off TLS support entirely (`have_ssl` reports `DISABLED`), verified
    directly against this image before writing this fixture.
    """
    with MySqlContainer("mysql:8.0", command="--ssl=0") as container:
        yield container


def _require_tls_connect_args(uri_query: str = "ssl=1") -> tuple[URL, dict[str, Any]]:
    """Run a `ssl=1` request through the real `adjust_engine_params` path.

    Goes through `MySQLEngineSpec.adjust_engine_params` rather than calling
    `require_mysql_tls` directly, so the test exercises the exact call path
    production code takes (including driver-name resolution from a bare
    `mysql://` URL), not a shortcut around it.
    """
    uri = make_url(f"mysql://root:test@placeholder:3306/test?{uri_query}")
    return MySQLEngineSpec.adjust_engine_params(uri, {})


def test_require_mysql_tls_fails_closed_without_server_tls(
    no_tls_container: MySqlContainer,
) -> None:
    """
    The core guarantee apache/superset#44723 exists to provide: a server
    offering no TLS at all must make the connection fail, never succeed
    silently in cleartext. mysqlclient linked against MariaDB Connector/C
    maps `ssl_mode=REQUIRED` to *opportunistic* TLS -- it degrades to
    cleartext instead of refusing when the server can't negotiate TLS --
    which is exactly the silent-downgrade this fix closes by requiring
    `VERIFY_CA` instead for that client library. Only a real client library
    actually attempting real TLS negotiation against a real non-TLS server
    can show this; a mocked cursor never negotiates anything.
    """
    host = _tcp_host(no_tls_container)
    port = no_tls_container.get_exposed_port(no_tls_container.port)
    uri, connect_args = _require_tls_connect_args()
    uri = uri.set(host=host, port=int(port), database=no_tls_container.dbname)
    engine = create_engine(uri, connect_args=connect_args)
    # Match the TLS refusal itself: an unrelated auth failure (e.g. 1045 or
    # 2061) also raises OperationalError and would pass with the fix reverted.
    with pytest.raises(OperationalError, match="SSL is required"):
        with engine.connect():
            pass


@pytest.fixture(scope="module")
def tls_ca_path(mysql_container: MySqlContainer) -> Iterator[str]:
    """Extract the shared `engine` container's auto-generated CA to a file.

    `ssl_ca` resolves (per `SHOW VARIABLES LIKE 'ssl_ca'`, verified directly
    against this image) to `ca.pem` under the data directory. There's no
    testcontainers API for pulling a single file back out of a running
    container, so this shells out via the same `exec()` the rest of this
    suite already depends on. Depending on `mysql_container` (not spinning
    up a second one) reuses the exact server `engine`'s tests already talk
    to, so the extracted CA is guaranteed to match.
    """
    result = mysql_container.exec(["cat", "/var/lib/mysql/ca.pem"])
    assert result.exit_code == 0, "could not read the auto-generated CA cert"
    with tempfile.NamedTemporaryFile(mode="wb", suffix=".pem") as ca_file:
        ca_file.write(result.output)
        # Flush so the CA is on disk before the client library reads the path;
        # an unflushed (empty) file makes the driver fall back to default
        # system trust paths and fail.
        ca_file.flush()
        yield ca_file.name


def test_require_mysql_tls_connects_with_verified_tls(
    engine: Engine, tls_ca_path: str
) -> None:
    """
    The other side of the same guarantee as the fail-closed test above: a
    fix that merely refused every connection would also pass that test
    while breaking every legitimate encrypted connection. The default
    `mysql:8.0` image auto-generates a CA/server cert pair with TLS
    available out of the box (verified directly: `have_ssl` reports `YES`),
    so a request that actually trusts that CA must still succeed, and must
    be genuinely encrypted rather than merely accepted -- asserted here via
    `Ssl_cipher`, which MySQL reports empty for a plaintext session.
    """
    uri, connect_args = _require_tls_connect_args(f"ssl=1&ssl_ca={tls_ca_path}")
    uri = uri.set(
        host=engine.url.host, port=engine.url.port, database=engine.url.database
    )
    tls_engine = create_engine(uri, connect_args=connect_args)
    with tls_engine.connect() as conn:
        cipher = conn.execute(text("SHOW STATUS LIKE 'Ssl_cipher'")).fetchone()
        assert cipher is not None
        assert cipher[1], "connection succeeded but is not actually using TLS"


@pytest.mark.parametrize("isolation_level", ["REPEATABLE READ", "READ COMMITTED"])
@pytest.mark.parametrize("winner", ["stop", "worker"])
def test_stop_at_target_commit_is_serialized(
    mysql_container: MySqlContainer,
    monkeypatch: pytest.MonkeyPatch,
    winner: str,
    isolation_level: str,
) -> None:
    """MySQL locking reads serialize Stop with the target commit under RR and RC."""
    from concurrent.futures import ThreadPoolExecutor, TimeoutError
    from threading import Event

    from sqlalchemy.orm import scoped_session, sessionmaker

    from superset.constants import QUERY_TARGET_COMMITTED_KEY
    from superset.extensions import db
    from superset.models.sql_lab import Query
    from superset.sql.execution.utils import (
        commit_target_transaction,
        set_query_stopped,
    )

    engine = create_engine(
        URL.create(
            "mysql+pymysql",
            username=mysql_container.username,
            password=mysql_container.password,
            host=_tcp_host(mysql_container),
            port=int(mysql_container.get_exposed_port(mysql_container.port)),
            database=mysql_container.dbname,
        )
    )
    with engine.begin() as connection:
        connection.execute(
            text("CREATE TABLE IF NOT EXISTS dbs (id INTEGER PRIMARY KEY)")
        )
        connection.execute(
            text("CREATE TABLE IF NOT EXISTS ab_user (id INTEGER PRIMARY KEY)")
        )
        connection.execute(text("INSERT IGNORE INTO dbs VALUES (1)"))
    Query.__table__.create(engine, checkfirst=True)
    sessions = scoped_session(
        sessionmaker(bind=engine.execution_options(isolation_level=isolation_level))
    )
    monkeypatch.setattr(db, "session", sessions)
    sessions.add(
        Query(
            id=126,
            client_id="commit-stop",
            database_id=1,
            status="running",
            sql="SELECT 1",
        )
    )
    sessions.commit()
    committing = Event()
    release = Event()
    stopping = Event()

    def target_commit() -> None:
        """Keep the target commit pending while Stop attempts its guarded write."""
        committing.set()
        assert release.wait(10)

    def work() -> bool:
        """Hold the metadata lock across the target commit."""
        try:
            return commit_target_transaction(sessions.get(Query, 126), target_commit)
        finally:
            sessions.remove()

    def stop() -> bool:
        """Read the row before the worker commits its target-committed marker."""
        try:
            query = sessions.get(Query, 126)
            stopping.set()
            accepted = set_query_stopped(query, 1234.5)
            sessions.commit()
            return accepted
        finally:
            sessions.remove()

    try:
        if winner == "stop":
            assert stop() is True
            assert work() is False
            assert not committing.is_set()
        else:
            with ThreadPoolExecutor(max_workers=2) as pool:
                worker = pool.submit(work)
                try:
                    assert committing.wait(10)
                    stopper = pool.submit(stop)
                    assert stopping.wait(10)
                    with pytest.raises(TimeoutError):
                        stopper.result(timeout=0.2)
                finally:
                    release.set()
                assert worker.result(timeout=10) is True
                assert stopper.result(timeout=10) is False
        sessions.expire_all()
        query = sessions.get(Query, 126)
        assert query.status == ("stopped" if winner == "stop" else "running")
        assert bool(query.extra.get(QUERY_TARGET_COMMITTED_KEY)) is (winner == "worker")
    finally:
        release.set()
        sessions.rollback()
        sessions.query(Query).filter_by(id=126).delete()
        sessions.commit()
        sessions.remove()
        engine.dispose()
