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
Tests db_engine_specs.mariadb against a real MariaDB instance, spun up on
demand via testcontainers. Run via .github/workflows/testcontainers.yml.

MariaDB is a MySQL fork implementing the same wire protocol: connects via
the plain "mysql" dialect with mysqlclient, same as vanilla MySQL, just
pointed at the mariadb image instead of mysql:latest.

Could not be verified locally in this environment: mysqlclient (MySQLdb)
has a pre-existing, unrelated native-library linking issue against this
machine's Homebrew-installed libmysqlclient. CI installs it via apt on
Linux, where this does not occur.

Also covers `require_mysql_tls` (apache/superset#44723) against
`MariaDBEngineSpec` specifically -- test_mysql.py's own TLS coverage
(apache/superset#44910) only ever exercises `MySQLEngineSpec` against a
MySQL server, never this inherited-but-distinct engine/dialect combination.
Separately, this is also the actual engine implicated in the underlying
client-library bug (mysqlclient linked against MariaDB Connector/C maps
`ssl_mode=REQUIRED` to opportunistic TLS -- see CONC-729 upstream): CI's own
apt-installed mysqlclient happens to link Oracle's libmysqlclient rather
than Connector/C (per `_mysqlclient_ssl_mode`'s client-info detection, and
as noted in test_mysql.py's docstring), so neither this file nor
test_mysql.py exercises that specific vulnerable client-library combination
end-to-end in CI today -- but this still covers the `MariaDBEngineSpec`
code path, and guards against a regression if that ever changes.
"""

import ipaddress
import os
import tempfile
from collections.abc import Iterator
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
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

from superset.db_engine_specs.mariadb import MariaDBEngineSpec
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

    Same rewrite test_mysql.py applies: get_connection_url() defaults to the
    literal string "localhost" on native Linux Docker (e.g. GitHub Actions
    runners), which MySQLdb treats as a request for a local Unix socket
    instead of TCP, failing since the server is actually a container reached
    over the network.
    """
    host = container.get_container_host_ip()
    return "127.0.0.1" if host == "localhost" else host


@pytest.fixture(scope="module")
def engine() -> Iterator[Engine]:
    with MySqlContainer("mariadb:11") as container:
        host = _tcp_host(container)
        port = container.get_exposed_port(container.port)
        yield create_engine(
            f"mysql://{container.username}:{container.password}"
            f"@{host}:{port}/{container.dbname}"
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
    MariaDBEngineSpec.get_columns wraps a real SQLAlchemy Inspector; this
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
    columns = MariaDBEngineSpec.get_columns(inspector, Table("pilot_types"))

    by_name = {col["column_name"]: col for col in columns}
    assert set(by_name) == {"id", "amount"}
    for col in by_name.values():
        spec = MariaDBEngineSpec.get_column_spec(str(col["type"]))
        assert spec is not None
        assert spec.generic_type == GenericDataType.NUMERIC
        assert isinstance(spec.sqla_type, Integer)


@pytest.fixture(scope="module")
def no_tls_container() -> Iterator[MySqlContainer]:
    """A server with TLS fully disabled, to test the fail-closed guarantee.

    `--skip-ssl` turns off TLS support entirely on this image (`have_ssl`
    reports `DISABLED`), verified directly against this image before
    writing this fixture.
    """
    with MySqlContainer("mariadb:11", command="--skip-ssl") as container:
        yield container


def _require_tls_connect_args(uri_query: str = "ssl=1") -> tuple[URL, dict[str, Any]]:
    """Run a `ssl=1` request through the real `adjust_engine_params` path.

    Goes through `MariaDBEngineSpec.adjust_engine_params` (inherited from
    `MySQLEngineSpec`, but exercised here as the actual class Superset
    dispatches to for a `mariadb` connection) rather than calling
    `require_mysql_tls` directly, so the test exercises the exact call path
    production code takes for this engine.
    """
    uri = make_url(f"mysql://root:test@placeholder:3306/test?{uri_query}")
    return MariaDBEngineSpec.adjust_engine_params(uri, {})


def test_require_mysql_tls_fails_closed_without_server_tls(
    no_tls_container: MySqlContainer,
) -> None:
    """
    Same guarantee as test_mysql.py's version of this test (apache/superset#44723):
    a server offering no TLS at all must make the connection fail, never
    succeed silently in cleartext. A mocked cursor can't observe this -- the
    behavior lives in the C client library's own TLS negotiation, decided
    once, at real connection time, against a real server's real TLS posture.
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


def _docker_host() -> str | None:
    """Host address the Docker daemon is reachable on, for the cert SAN."""
    from testcontainers.core.docker_client import DockerClient

    host = DockerClient().host()
    return None if host in ("localhost", "127.0.0.1") else host


def _write_self_signed_cert(
    cert_dir: Path,
    ca_common_name: str = "superset-testcontainers-ca",
    docker_host: str | None = None,
) -> None:
    """Write a throwaway CA + server cert/key into `cert_dir`.

    Unlike the `mysql:8.0` image, `mariadb`'s image does not auto-generate a
    CA/cert pair when TLS is enabled: `have_ssl` reports `YES` out of the
    box, but `ssl_ca`/`ssl_cert`/`ssl_key` all report empty and no cert
    files exist anywhere under `/var/lib/mysql` (verified directly against
    this image) -- so there's nothing to extract back out the way
    test_mysql.py's `tls_ca_path` fixture does for `mysql:8.0`. Generate a
    throwaway one instead and copy it into a dedicated container via
    `--ssl-cert`/`--ssl-key`/`--ssl-ca`, verified directly to work against
    this image.
    """
    now = datetime.now(timezone.utc)

    ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    ca_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, ca_common_name)])
    ca_cert = (
        x509.CertificateBuilder()
        .subject_name(ca_name)
        .issuer_name(ca_name)
        .public_key(ca_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=5))
        .not_valid_after(now + timedelta(hours=1))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(ca_key, hashes.SHA256())
    )

    # MariaDB Connector/C maps VERIFY_CA to a check that also validates the
    # hostname, so the cert must name every address the tests connect to.
    san_entries: list[x509.GeneralName] = [
        x509.DNSName("localhost"),
        x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
    ]
    if docker_host:
        try:
            san_entries.append(x509.IPAddress(ipaddress.ip_address(docker_host)))
        except ValueError:
            san_entries.append(x509.DNSName(docker_host))

    server_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    server_name = x509.Name(
        [x509.NameAttribute(NameOID.COMMON_NAME, "mariadb-testcontainer")]
    )
    server_cert = (
        x509.CertificateBuilder()
        .subject_name(server_name)
        .issuer_name(ca_name)
        .public_key(server_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=5))
        .not_valid_after(now + timedelta(hours=1))
        .add_extension(x509.SubjectAlternativeName(san_entries), critical=False)
        .sign(ca_key, hashes.SHA256())
    )

    (cert_dir / "ca.pem").write_bytes(ca_cert.public_bytes(serialization.Encoding.PEM))
    (cert_dir / "server-cert.pem").write_bytes(
        server_cert.public_bytes(serialization.Encoding.PEM)
    )
    (cert_dir / "server-key.pem").write_bytes(
        server_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    # Readable by the container's mysql user once copied into the container.
    for name in ("ca.pem", "server-cert.pem", "server-key.pem"):
        os.chmod(cert_dir / name, 0o644)


@pytest.fixture(scope="module")
def tls_container() -> Iterator[tuple[MySqlContainer, str]]:
    """A MariaDB server with a throwaway, explicitly-configured TLS cert.

    Needs its own container rather than reusing the shared `engine`
    container the way test_mysql.py's `tls_ca_path` fixture does: the cert
    has to be mounted in and pointed to via command-line flags at container
    start time, and there's no running-container equivalent of "extract the
    cert the image already auto-generated" the way there is for `mysql:8.0`.
    """
    with tempfile.TemporaryDirectory() as cert_dir_str:
        cert_dir = Path(cert_dir_str)
        _write_self_signed_cert(cert_dir, docker_host=_docker_host())
        container = MySqlContainer(
            "mariadb:11",
            command=(
                "--ssl-cert=/certs/server-cert.pem "
                "--ssl-key=/certs/server-key.pem "
                "--ssl-ca=/certs/ca.pem"
            ),
        )
        # Copied in before mysqld starts rather than bind-mounted: a mount is
        # resolved on the Docker daemon's host, which is empty of these files
        # with a remote DOCKER_HOST or Docker-in-Docker.
        for name in ("ca.pem", "server-cert.pem", "server-key.pem"):
            container.with_copy_into_container(cert_dir / name, f"/certs/{name}", 0o644)
        with container as started:
            yield started, str(cert_dir / "ca.pem")


def test_require_mysql_tls_rejects_untrusted_ca(
    tls_container: tuple[MySqlContainer, str], tmp_path: Path
) -> None:
    """
    Guards the verification itself: a CA that did not sign the server's cert
    must be rejected. `Ssl_cipher` alone only shows the session is encrypted,
    so this fails if `ssl_ca` is dropped or ignored. `VERIFY_CA` is requested
    explicitly so the outcome does not depend on which client library
    mysqlclient links (plain `REQUIRED` only demands encryption on Oracle's).
    """
    container, _ = tls_container
    # A distinct subject keeps OpenSSL from matching this CA to the server's
    # issuer by name, so the failure is an untrusted issuer, not a bad signature.
    _write_self_signed_cert(
        tmp_path, ca_common_name="superset-untrusted-ca", docker_host=_docker_host()
    )
    wrong_ca = tmp_path / "ca.pem"
    host = _tcp_host(container)
    port = container.get_exposed_port(container.port)
    uri, connect_args = _require_tls_connect_args(
        f"ssl=1&ssl_mode=VERIFY_CA&ssl_ca={wrong_ca}"
    )
    uri = uri.set(host=host, port=int(port), database=container.dbname)
    tls_engine = create_engine(uri, connect_args=connect_args)
    # Match only a failure a real verification emits: the "CA certificate is
    # required if ssl-mode is VERIFY_CA" message for a missing CA must not pass.
    with pytest.raises(
        OperationalError,
        match=(
            r"(?i)self.signed|unable to get (local )?issuer"
            r"|certificate verify failed"
        ),
    ):
        with tls_engine.connect():
            pass


def test_require_mysql_tls_connects_with_verified_tls(
    tls_container: tuple[MySqlContainer, str],
) -> None:
    """
    The other side of the same guarantee as the fail-closed test above: a
    fix that merely refused every connection would also pass that test while
    breaking every legitimate encrypted connection. A request that actually
    trusts the server's CA must still succeed, and must be genuinely
    encrypted rather than merely accepted -- asserted here via `Ssl_cipher`,
    which MariaDB reports empty for a plaintext session.
    """
    container, ca_path = tls_container
    host = _tcp_host(container)
    port = container.get_exposed_port(container.port)
    uri, connect_args = _require_tls_connect_args(
        f"ssl=1&ssl_mode=VERIFY_CA&ssl_ca={ca_path}"
    )
    uri = uri.set(host=host, port=int(port), database=container.dbname)
    tls_engine = create_engine(uri, connect_args=connect_args)
    with tls_engine.connect() as conn:
        cipher = conn.execute(text("SHOW STATUS LIKE 'Ssl_cipher'")).fetchone()
        assert cipher is not None
        assert cipher[1], "connection succeeded but is not actually using TLS"
