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

from collections.abc import Iterator
from typing import Any, Optional
from unittest.mock import MagicMock, Mock, patch

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import JSON, types
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import NoSuchModuleError

from superset.db_engine_specs.doris import (
    AggState,
    ARRAY,
    BITMAP,
    DOUBLE,
    HLL,
    LARGEINT,
    MAP,
    QuantileState,
    STRUCT,
    TINYINT,
)
from superset.utils.core import GenericDataType
from tests.common.assert_utils import assert_called_once_with_text
from tests.unit_tests.db_engine_specs.utils import assert_column_spec


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        # Numeric
        ("tinyint", TINYINT, None, GenericDataType.NUMERIC, False),
        ("largeint", LARGEINT, None, GenericDataType.NUMERIC, False),
        ("decimal(38,18)", types.DECIMAL, None, GenericDataType.NUMERIC, False),
        ("decimalv3(38,18)", types.DECIMAL, None, GenericDataType.NUMERIC, False),
        ("double", DOUBLE, None, GenericDataType.NUMERIC, False),
        # String
        ("char(10)", types.CHAR, None, GenericDataType.STRING, False),
        ("varchar(65533)", types.VARCHAR, None, GenericDataType.STRING, False),
        ("binary", types.BINARY, None, GenericDataType.STRING, False),
        ("text", types.TEXT, None, GenericDataType.STRING, False),
        ("string", types.String, None, GenericDataType.STRING, False),
        # Date
        ("datetimev2", types.DateTime, None, GenericDataType.TEMPORAL, True),
        ("datev2", types.Date, None, GenericDataType.TEMPORAL, True),
        # Complex type
        ("array<varchar(65533)>", ARRAY, None, GenericDataType.STRING, False),
        ("map<string,int>", MAP, None, GenericDataType.STRING, False),
        ("struct<int,string>", STRUCT, None, GenericDataType.STRING, False),
        ("json", JSON, None, GenericDataType.STRING, False),
        ("jsonb", JSON, None, GenericDataType.STRING, False),
        ("bitmap", BITMAP, None, GenericDataType.STRING, False),
        ("hll", HLL, None, GenericDataType.STRING, False),
        ("quantile_state", QuantileState, None, GenericDataType.STRING, False),
        ("agg_state", AggState, None, GenericDataType.STRING, False),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[types.TypeEngine],
    attrs: Optional[dict[str, Any]],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    from superset.db_engine_specs.doris import DorisEngineSpec as spec  # noqa: N813

    assert_column_spec(spec, native_type, sqla_type, attrs, generic_type, is_dttm)


@pytest.mark.parametrize(
    "sqlalchemy_uri, connect_args, catalog, schema, return_schema,return_connect_args",
    [
        (
            "doris://user:password@host/db1",
            {"param1": "some_value"},
            None,
            None,
            "db1",
            {"param1": "some_value"},
        ),
        (
            "pydoris://user:password@host/db1",
            {"param1": "some_value"},
            None,
            None,
            "db1",
            {"param1": "some_value"},
        ),
        (
            "doris://user:password@host/catalog1.db1",
            {"param1": "some_value"},
            None,
            None,
            "catalog1.db1",
            {"param1": "some_value"},
        ),
        (
            "pydoris://user:password@host/catalog1.db1",
            {"param1": "some_value"},
            None,
            None,
            "catalog1.db1",
            {"param1": "some_value"},
        ),
        (
            "pydoris://user:password@host/catalog1.db1",
            {"param1": "some_value"},
            "catalog2",
            None,
            "catalog2.db1",
            {"param1": "some_value"},
        ),
        (
            "pydoris://user:password@host/catalog1.db1",
            {"param1": "some_value"},
            None,
            "db2",
            "catalog1.db2",
            {"param1": "some_value"},
        ),
        (
            "pydoris://user:password@host/catalog1.db1",
            {"param1": "some_value"},
            "catalog2",
            "db2",
            "catalog2.db2",
            {"param1": "some_value"},
        ),
    ],
)
def test_adjust_engine_params(
    sqlalchemy_uri: str,
    connect_args: dict[str, Any],
    catalog: str | None,
    schema: str | None,
    return_schema: str,
    return_connect_args: dict[str, Any],
) -> None:
    from superset.db_engine_specs.doris import DorisEngineSpec

    url = make_url(sqlalchemy_uri)
    returned_url, returned_connect_args = DorisEngineSpec.adjust_engine_params(
        url,
        connect_args,
        catalog,
        schema,
    )

    assert returned_url.database == return_schema
    assert returned_connect_args == return_connect_args


def test_adjust_engine_params_no_database() -> None:
    """
    Test that we raise an exception when the database is not specified.
    """
    from superset.db_engine_specs.doris import DorisEngineSpec

    url = make_url("doris://user:password@host")
    with pytest.raises(
        ValueError,
        match="Doris requires a database to be specified in the URI.",
    ):
        DorisEngineSpec.adjust_engine_params(url, {})


@pytest.mark.parametrize(
    "url,expected_schema",
    [
        ("doris://localhost:9030/hive.test", "test"),
        ("doris://localhost:9030/test", "test"),
        ("doris://localhost:9030/", None),
    ],
)
def test_get_schema_from_engine_params(
    url: str, expected_schema: Optional[str]
) -> None:
    """
    Test the ``get_schema_from_engine_params`` method.
    """
    from superset.db_engine_specs.doris import DorisEngineSpec

    assert (
        DorisEngineSpec.get_schema_from_engine_params(
            make_url(url),
            {},
        )
        == expected_schema
    )


@pytest.mark.parametrize(
    "database_value,expected_catalog",
    [
        ("catalog1.schema1", "catalog1"),
        ("schema1", "catalog2"),
        ("", "catalog2"),
    ],
)
def test_get_default_catalog(
    mocker: MockerFixture,
    database_value: Optional[str],
    expected_catalog: Optional[str],
) -> None:
    """
    Test the ``get_default_catalog`` method.
    """
    from superset.db_engine_specs.doris import DorisEngineSpec
    from superset.models.core import Database

    database = mocker.MagicMock(spec=Database)
    database.url_object.database = database_value
    rows = [
        mocker.MagicMock(IsCurrent=False, CatalogName="catalog1"),
        mocker.MagicMock(IsCurrent=True, CatalogName="catalog2"),
    ]
    with database.get_sqla_engine() as engine:
        engine.connect().__enter__().execute.return_value = rows

    assert DorisEngineSpec.get_default_catalog(database) == expected_catalog


@pytest.mark.parametrize(
    "mock_catalogs,expected_result",
    [
        (
            [
                Mock(CatalogName="catalog1"),
                Mock(CatalogName="catalog2"),
                Mock(CatalogName="catalog3"),
            ],
            {"catalog1", "catalog2", "catalog3"},
        ),
        (
            [Mock(CatalogName="single_catalog")],
            {"single_catalog"},
        ),
        (
            [],
            set(),
        ),
    ],
)
def test_get_catalog_names(
    mock_catalogs: list[Mock], expected_result: set[str]
) -> None:
    """
    Test the ``get_catalog_names`` method.
    """
    from superset.db_engine_specs.doris import DorisEngineSpec
    from superset.models.core import Database

    database = Mock(spec=Database)
    inspector = MagicMock()
    inspector.engine.connect().__enter__().execute.return_value = mock_catalogs

    catalogs = DorisEngineSpec.get_catalog_names(database, inspector)

    # Verify the SQL query
    with inspector.engine.connect() as conn:
        assert_called_once_with_text(
            conn.execute,
            "SHOW CATALOGS",
        )

    # Verify the returned catalog names
    assert catalogs == expected_result


def _install_pydoris(mocker: MockerFixture) -> None:
    """
    Make ``DorisEngineSpec`` the only engine spec, with the two entry points
    pydoris ships installed.
    """
    from sqlalchemy.dialects.mysql.mysqldb import MySQLDialect_mysqldb

    from superset.db_engine_specs.doris import DorisEngineSpec

    class PyDorisDialect(MySQLDialect_mysqldb):
        name = "pydoris"

    def entry_point(name: str) -> Any:
        ep = mocker.MagicMock()
        ep.name = name
        ep.value = "pydoris.sqlalchemy.dialect:DorisDialect"
        ep.load.return_value = PyDorisDialect
        return ep

    mocker.patch(
        "superset.db_engine_specs.load_engine_specs",
        return_value=iter([DorisEngineSpec]),
    )
    mocker.patch(
        "superset.db_engine_specs.entry_points",
        side_effect=lambda group: (
            [entry_point("doris"), entry_point("pydoris")]
            if group == "sqlalchemy.dialects"
            else []
        ),
    )


def test_connection_form_default_driver_is_installed(mocker: MockerFixture) -> None:
    """
    The database picker offers the connection form only when ``default_driver``
    is among the drivers installed for the engine. pydoris registers a
    ``MySQLDialect_mysqldb`` subclass named ``pydoris`` under both the ``doris``
    and ``pydoris`` entry points, so its driver is ``mysqldb``.
    """
    from superset.db_engine_specs import get_available_engine_specs
    from superset.db_engine_specs.doris import DorisEngineSpec

    _install_pydoris(mocker)

    drivers = get_available_engine_specs()[DorisEngineSpec]

    assert drivers == {"mysqldb"}
    assert DorisEngineSpec.default_driver in drivers


@pytest.mark.parametrize(
    "app,hidden",
    [
        ({"DBS_AVAILABLE_DENYLIST": {"pydoris": {"mysqldb"}}}, True),
        ({"DBS_AVAILABLE_DENYLIST": {"pydoris": {"pydoris"}}}, False),
    ],
    indirect=["app"],
)
def test_denylist_matches_the_default_driver(
    mocker: MockerFixture, hidden: bool
) -> None:
    """
    ``DBS_AVAILABLE_DENYLIST`` is matched against ``default_driver``, so Doris is
    hidden with ``{"pydoris": {"mysqldb"}}``, not ``{"pydoris": {"pydoris"}}``.
    """
    from superset.db_engine_specs import get_available_engine_specs
    from superset.db_engine_specs.doris import DorisEngineSpec

    _install_pydoris(mocker)

    assert (DorisEngineSpec not in get_available_engine_specs()) is hidden


@pytest.fixture
def pydoris_dialects() -> Iterator[None]:
    """
    Register the two entry points pydoris ships, so that a URI can be resolved
    to a dialect the way :func:`sqlalchemy.create_engine` resolves one.
    """
    from sqlalchemy.dialects import registry

    for name in ("doris", "pydoris"):
        registry.register(
            name, "sqlalchemy.dialects.mysql.mysqldb", "MySQLDialect_mysqldb"
        )
    yield
    for name in ("doris", "pydoris"):
        registry.impls.pop(name, None)


@pytest.mark.parametrize("encryption", [False, True])
@pytest.mark.usefixtures("pydoris_dialects")
def test_build_sqlalchemy_uri_uses_the_pydoris_scheme(encryption: bool) -> None:
    """
    A URI built from the connection form must name a registered dialect:
    ``pydoris+mysqldb`` (``engine+default_driver``) is not one, ``pydoris`` is.
    Its backend must also equal ``engine``, which the edit modal matches against
    to find the connection form of a saved database.
    """
    from sqlalchemy.dialects.mysql.mysqldb import MySQLDialect_mysqldb

    from superset.db_engine_specs.base import BasicParametersType
    from superset.db_engine_specs.doris import DorisEngineSpec

    parameters: BasicParametersType = {
        "username": "user",
        "password": "p@ss",
        "host": "doris.example.com",
        "port": 9030,
        "database": "internal.sales",
        "query": {},
        "encryption": encryption,
    }

    uri = DorisEngineSpec.build_sqlalchemy_uri(parameters)

    url = make_url(uri)
    assert url.drivername == "pydoris"
    assert url.get_backend_name() == DorisEngineSpec.engine
    # Resolving the dialect is what ``create_engine`` does first, and is the
    # step that fails for a scheme no entry point provides.
    assert url.get_dialect() is MySQLDialect_mysqldb
    assert (url.username, url.password, url.host, url.port, url.database) == (
        "user",
        "p@ss",
        "doris.example.com",
        9030,
        "internal.sales",
    )
    assert DorisEngineSpec.get_parameters_from_uri(uri)["encryption"] is encryption

    # The SSL switch must reach mysqlclient as a mode that requires TLS.
    _, connect_kwargs = MySQLDialect_mysqldb().create_connect_args(url)
    assert "ssl" not in connect_kwargs
    assert connect_kwargs.get("ssl_mode") == ("VERIFY_CA" if encryption else None)


@pytest.mark.usefixtures("pydoris_dialects")
def test_engine_plus_default_driver_scheme_has_no_dialect() -> None:
    """
    ``engine+default_driver`` is the scheme the connection form would emit
    without the override; pydoris registers no such entry point.
    """
    from superset.db_engine_specs.doris import DorisEngineSpec

    scheme = f"{DorisEngineSpec.engine}+{DorisEngineSpec.default_driver}"

    with pytest.raises(NoSuchModuleError):
        make_url(f"{scheme}://user:p@ss@doris.example.com:9030/db").get_dialect()


@pytest.mark.parametrize(
    "native_type,generic_type",
    [
        ("variant", GenericDataType.STRING),
        ("ipv4", GenericDataType.STRING),
        ("ipv6", GenericDataType.STRING),
        # MySQL protocol type names reported for SQL Lab result columns
        ("NEWDECIMAL", GenericDataType.NUMERIC),
        ("TINY", GenericDataType.NUMERIC),
        ("SHORT", GenericDataType.NUMERIC),
        ("BLOB", GenericDataType.STRING),
    ],
)
def test_get_column_spec_extra_types(
    native_type: str, generic_type: GenericDataType
) -> None:
    """Doris-only and MySQL-protocol result types map to a generic type."""
    from superset.db_engine_specs.doris import DorisEngineSpec

    spec = DorisEngineSpec.get_column_spec(native_type)
    assert spec is not None
    assert spec.generic_type == generic_type


def test_quarter_time_grain_avoids_interval_quarter() -> None:
    """The quarter grain avoids ``INTERVAL n QUARTER``, which Doris rejects."""
    from superset.constants import TimeGrain
    from superset.db_engine_specs.doris import DorisEngineSpec

    expression = DorisEngineSpec._time_grain_expressions[TimeGrain.QUARTER]
    assert expression == (
        "MAKEDATE(YEAR({col}), 1) + INTERVAL (QUARTER({col}) - 1) * 3 MONTH"
    )
    assert "INTERVAL 1 QUARTER" not in expression


@pytest.mark.parametrize(
    "message,error_type",
    [
        (
            "(2002, \"Can't connect to server on '127.0.0.1' (115)\")",
            "CONNECTION_HOST_DOWN_ERROR",
        ),
        (
            "(2003, \"Can't connect to MySQL server on 'db' (111)\")",
            "CONNECTION_HOST_DOWN_ERROR",
        ),
        (
            "(2005, \"Unknown server host 'no-such-host.invalid' (-2)\")",
            "CONNECTION_INVALID_HOSTNAME_ERROR",
        ),
        (
            "(1105, \"errCode = 2, detailMessage = \\nmismatched input 'SELEC' "
            "expecting {<EOF>, ';'}\")",
            "SYNTAX_ERROR",
        ),
        (
            "(1105, 'errCode = 2, detailMessage = Table [missing] does not exist "
            "in database [db].(line 1, pos 14)')",
            "TABLE_DOES_NOT_EXIST_ERROR",
        ),
        (
            "(1105, 'errCode = 2, detailMessage = Database [nodb] does not exist."
            "(line 1, pos 14)')",
            "SCHEMA_DOES_NOT_EXIST_ERROR",
        ),
        (
            "(1105, \"errCode = 2, detailMessage = Unknown column 'nope' in "
            "'table list' in PROJECT clause(line 1, pos 7)\")",
            "COLUMN_DOES_NOT_EXIST_ERROR",
        ),
        (
            "(1045, \"Access denied for user 'root@10.0.0.1' (using password: YES)\")",
            "CONNECTION_ACCESS_DENIED_ERROR",
        ),
        (
            "(1049, \"errCode = 2, detailMessage = Unknown database 'nodb'\")",
            "CONNECTION_UNKNOWN_DATABASE_ERROR",
        ),
    ],
)
def test_extract_errors(message: str, error_type: str) -> None:
    """Driver errors map to the corresponding Superset error types."""
    from superset.db_engine_specs.doris import DorisEngineSpec

    errors = DorisEngineSpec.extract_errors(Exception(message))
    assert errors[0].error_type.name == error_type


def test_build_sqlalchemy_uri() -> None:
    """The parameters form builds a valid Doris URI with optional verified TLS."""
    from superset.db_engine_specs.base import BasicParametersType
    from superset.db_engine_specs.doris import DorisEngineSpec

    parameters: BasicParametersType = {
        "username": "user",
        "password": "p@ss",
        "host": "doris.example.com",
        "port": 9030,
        "database": "internal.db",
        "query": {},
    }
    encrypted = make_url(
        DorisEngineSpec.build_sqlalchemy_uri({**parameters, "encryption": True})
    )
    assert encrypted.drivername == "pydoris"
    assert dict(encrypted.query) == {"ssl_mode": "VERIFY_CA"}
    assert encrypted.password == "p@ss"  # noqa: S105

    plain = make_url(
        DorisEngineSpec.build_sqlalchemy_uri({**parameters, "encryption": False})
    )
    assert plain.drivername == "pydoris"
    assert dict(plain.query) == {}

    round_trip = DorisEngineSpec.get_parameters_from_uri(
        encrypted.render_as_string(hide_password=False)
    )
    assert round_trip["encryption"] is True
    assert round_trip["query"] == {}


@pytest.mark.parametrize("client_info", ["3.3.17", "8.4.6"])
@pytest.mark.parametrize("source", ["toggle", "ssl=1", "ssl_mode=REQUIRED"])
def test_doris_tls_request_uses_verification(source: str, client_info: str) -> None:
    """
    The toggle always verifies. Scalar SSL and legacy REQUIRED requests keep
    REQUIRED only with an Oracle client, which does not fall back to cleartext.
    """
    from superset.db_engine_specs.doris import DorisEngineSpec

    if source == "toggle":
        uri = make_url(
            DorisEngineSpec.build_sqlalchemy_uri(
                {
                    "username": "root",
                    "host": "localhost",
                    "port": 9030,
                    "database": "internal.db",
                    "encryption": True,
                }
            )
        )
    else:
        uri = make_url(f"doris://root@localhost/internal.db?{source}")
    with patch("superset.db_engine_specs.mysql.import_module") as module:
        module.return_value.get_client_info.return_value = client_info
        url, args = DorisEngineSpec.adjust_engine_params(
            uri, {}, catalog="external", schema="other"
        )
    oracle_required = source != "toggle" and client_info == "8.4.6"
    expected_mode = "REQUIRED" if oracle_required else "VERIFY_CA"
    assert args.get("ssl_mode", url.query.get("ssl_mode")) == expected_mode
    assert url.drivername == ("pydoris" if source == "toggle" else "doris")
    assert url.database == "external.other"


@pytest.mark.parametrize("mode", ["DISABLED", "PREFERRED", None])
def test_doris_toggle_cannot_be_cancelled(mode: Optional[str]) -> None:
    """Connect arguments cannot cancel a REQUIRED request in the URI."""
    from superset.db_engine_specs.doris import DorisEngineSpec

    with pytest.raises(ValueError, match="conflicts"):
        DorisEngineSpec.adjust_engine_params(
            make_url("doris://root@localhost/internal.db?ssl_mode=REQUIRED"),
            {"ssl_mode": mode},
        )


def test_doris_tls_preserves_verified_mode_and_ca() -> None:
    """Explicit hostname verification and the native CA dictionary survive."""
    from superset.db_engine_specs.doris import DorisEngineSpec

    uri = make_url("doris://root@localhost/internal.db?ssl_mode=VERIFY_IDENTITY")
    _, args = DorisEngineSpec.adjust_engine_params(uri, {"ssl": {"ca": "/ca.pem"}})
    assert args["ssl_mode"] == "VERIFY_IDENTITY"
    assert args["ssl"] == {"ca": "/ca.pem"}


def test_unrequested_doris_connection_unchanged() -> None:
    """Connections without a TLS request retain their URI and arguments."""
    from superset.db_engine_specs.doris import DorisEngineSpec

    uri = make_url("doris://root@localhost/internal.db")
    assert DorisEngineSpec.adjust_engine_params(uri, {}) == (uri, {})


@pytest.mark.parametrize("mode", ["REQUIRED", "VERIFY_CA", "VERIFY_IDENTITY"])
def test_doris_tls_parameters_round_trip(mode: str) -> None:
    """Editing TLS URIs keeps encryption enabled and preserves stronger modes."""
    from superset.db_engine_specs.doris import DorisEngineSpec

    parameters = DorisEngineSpec.get_parameters_from_uri(
        f"doris://user:p%40ss@localhost:9030/internal.db?ssl_mode={mode}&charset=utf8mb4"
    )
    assert parameters["encryption"] is True
    expected_mode = "VERIFY_IDENTITY" if mode == "VERIFY_IDENTITY" else "VERIFY_CA"
    expected_query = {"charset": "utf8mb4"}
    if mode == "VERIFY_IDENTITY":
        expected_query["ssl_mode"] = mode
    assert parameters["query"] == expected_query
    uri = make_url(DorisEngineSpec.build_sqlalchemy_uri(parameters))
    assert uri.query == {"ssl_mode": expected_mode, "charset": "utf8mb4"}
    assert uri.password == "p@ss"  # noqa: S105
    assert parameters["encryption"] is True
    assert parameters["query"] == expected_query


@pytest.mark.parametrize("mode", ["REQUIRED", "VERIFY_CA", "VERIFY_IDENTITY"])
def test_doris_tls_preserves_uri_query(mode: str) -> None:
    """TLS normalization preserves unrelated and repeated URI query options."""
    from superset.db_engine_specs.doris import DorisEngineSpec

    uri = make_url(
        f"doris://root@localhost/internal.db?ssl_mode={mode}"
        "&charset=utf8mb4&ssl_ca=%2Fca.pem&option=first&option=second"
    )
    with patch("superset.db_engine_specs.mysql.import_module") as module:
        # MariaDB Connector/C, which needs REQUIRED upgraded to VERIFY_CA.
        module.return_value.get_client_info.return_value = "3.3.17"
        url, args = DorisEngineSpec.adjust_engine_params(uri, {})
    assert url == uri
    assert args["ssl_mode"] == ("VERIFY_CA" if mode == "REQUIRED" else mode)
