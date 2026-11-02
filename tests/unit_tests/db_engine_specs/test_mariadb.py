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

from typing import Any
from unittest.mock import patch

import pytest
from sqlalchemy.engine.url import make_url

from superset.db_engine_specs.mariadb import MariaDBEngineSpec
from superset.db_engine_specs.mysql import MySQLEngineSpec


def test_mariadb_inherits_from_mysql() -> None:
    assert issubclass(MariaDBEngineSpec, MySQLEngineSpec)


def test_mariadb_inherits_extended_aggregations() -> None:
    """
    MariaDB is a MySQL fork implementing the same aggregate functions, not a
    materially different query engine, so it inherits `_extended_aggregations`
    from `MySQLEngineSpec` unmodified -- see the comment above that dict.
    """
    assert MariaDBEngineSpec.get_extended_aggregation_func("STDDEV_SAMP") is not None
    assert MariaDBEngineSpec.get_extended_aggregation_func("VAR_SAMP") is not None
    # Same as MySQL, MEDIAN is not supported.
    assert MariaDBEngineSpec.get_extended_aggregation_func("MEDIAN") is None


@pytest.mark.parametrize(
    "client_info,expected_mode",
    [("3.3.17", "VERIFY_CA"), ("8.4.6", "REQUIRED")],
)
@pytest.mark.parametrize("source", ["toggle", "ssl=1", "ssl_mode=REQUIRED"])
def test_mariadb_tls_request_uses_verification(
    source: str, client_info: str, expected_mode: str
) -> None:
    """MariaDB URIs get the same fail-closed TLS as MySQL under mysqlclient."""
    if source == "toggle":
        uri = make_url(
            MariaDBEngineSpec.build_sqlalchemy_uri(
                {
                    "username": "user",
                    "host": "localhost",
                    "port": 3306,
                    "database": "db",
                    "encryption": True,
                },
                {},
            )
        )
    else:
        uri = make_url(f"mariadb://user@localhost/db?{source}")
    assert uri.get_backend_name() == "mariadb"
    with patch("superset.db_engine_specs.mysql.import_module") as module:
        module.return_value.get_client_info.return_value = client_info
        url, args = MariaDBEngineSpec.adjust_engine_params(uri, {}, schema="other")
    options = dict(url.query, **args)
    assert options["ssl_mode"] == expected_mode
    assert "ssl" not in options
    assert url.database == "other"


@pytest.mark.parametrize("options", [{"ssl_mode": "DISABLED"}, {"ssl_mode": None}])
def test_mariadb_tls_request_cannot_be_cancelled(options: dict[str, Any]) -> None:
    """An ssl_mode that disables or clears TLS conflicts with the SSL request."""
    with pytest.raises(ValueError, match="conflicts with ssl_mode"):
        MariaDBEngineSpec.adjust_engine_params(
            make_url("mariadb://localhost/db?ssl=1"), options
        )


def test_mariadb_pymysql_tls_request_requires_verification() -> None:
    """PyMySQL MariaDB SSL requests verify the certificate and keep the CA."""
    url, args = MariaDBEngineSpec.adjust_engine_params(
        make_url("mariadb+pymysql://localhost/db?ssl=1&ssl_ca=/ca.pem"), {}
    )
    assert args["ssl_verify_cert"] is True
    assert args["ssl_ca"] == "/ca.pem"
    assert "ssl" not in url.query


def test_mariadb_connector_tls_request_requires_verification() -> None:
    """MariaDB Connector/Python keeps its fail-closed ssl flag and verifies."""
    url, args = MariaDBEngineSpec.adjust_engine_params(
        make_url("mariadb+mariadbconnector://localhost/db?ssl=1"), {}
    )
    assert "ssl" not in url.query
    assert args["ssl"] is True
    assert args["ssl_verify_cert"] is True

    with pytest.raises(ValueError, match="requires ssl_verify_cert"):
        MariaDBEngineSpec.adjust_engine_params(
            make_url("mariadb+mariadbconnector://localhost/db?ssl=1"),
            {"ssl_verify_cert": False},
        )


def test_unrequested_mariadb_connection_unchanged() -> None:
    """Without an SSL request the URI and connect_args are returned untouched."""
    uri = make_url("mariadb://localhost/db")
    url, args = MariaDBEngineSpec.adjust_engine_params(uri, {})
    assert url == uri
    assert "ssl_mode" not in args
