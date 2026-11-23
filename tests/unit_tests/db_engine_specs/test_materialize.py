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

import re
from copy import deepcopy
from datetime import datetime
from unittest.mock import call, MagicMock

import pytest
from sqlalchemy.engine.url import make_url

from superset.db_engine_specs.base import BasicParametersType
from superset.db_engine_specs.materialize import (
    MaterializeEngineSpec as spec,  # noqa: N813
)
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm


@pytest.mark.parametrize("cluster", ["quickstart", "analytics & reporting"])
def test_build_sqlalchemy_uri_with_cluster(cluster: str) -> None:
    """Encode the cluster and credentials without mutating form parameters."""
    parameters: BasicParametersType = {
        "host": "localhost",
        "port": 6875,
        "username": "user@example.com",
        "password": "p@ss/word",
        "database": "materialize",
        "materializedb_cluster": cluster,
        "query": {"application_name": "superset"},
        "encryption": True,
    }
    original = deepcopy(parameters)

    url = make_url(spec.build_sqlalchemy_uri(parameters))

    assert url.drivername == "materialize+psycopg2"
    assert url.username == "user@example.com"
    assert url.password == parameters["password"]
    assert url.host == "localhost"
    assert url.port == 6875
    assert url.database == "materialize"
    escaped_cluster = re.sub(r"([\s\\])", r"\\\1", cluster)
    assert url.query["options"] == f"--cluster={escaped_cluster}"
    assert url.query["application_name"] == "superset"
    assert url.query["sslmode"] == "require"
    assert parameters == original


@pytest.mark.parametrize("cluster", [None, ""])
def test_build_sqlalchemy_uri_without_cluster(cluster: str | None) -> None:
    """An omitted or blank cluster preserves options supplied by the user."""
    parameters: BasicParametersType = {
        "host": "localhost",
        "database": "materialize",
        "query": {"options": "--cluster=custom"},
    }
    if cluster is not None:
        parameters["materializedb_cluster"] = cluster

    url = make_url(spec.build_sqlalchemy_uri(parameters))

    assert url.query["options"] == "--cluster=custom"
    assert url.port == 6875


def test_get_parameters_from_uri_reads_cluster() -> None:
    """Expose the saved cluster to the form and drop it from ``query``."""
    uri = "materialize+psycopg2://u@localhost:6875/materialize?options=--cluster%3Danalytics"

    parameters = spec.get_parameters_from_uri(uri)

    assert parameters["materializedb_cluster"] == "analytics"
    assert parameters["query"] == {}


def test_get_parameters_from_uri_without_cluster() -> None:
    """A URI without a cluster option yields no cluster parameter."""
    uri = "materialize+psycopg2://u@localhost:6875/materialize?application_name=x"

    parameters = spec.get_parameters_from_uri(uri)

    assert "materializedb_cluster" not in parameters
    assert parameters["query"] == {"application_name": "x"}


@pytest.mark.parametrize(
    "options",
    [
        "--statement_timeout=30s --application_name=superset",
        "--statement_timeout=30s --cluster=old --application_name=superset",
        "-c cluster=old --statement_timeout=30s --application_name=superset",
        "--statement_timeout=30s --application_name=superset -ccluster=old",
        "--cluster=first --statement_timeout=30s --cluster=old "
        "--application_name=superset",
    ],
)
def test_merge_cluster_and_additional_options(options: str) -> None:
    """The form cluster wins while unrelated startup and query options survive."""
    parameters: BasicParametersType = {
        "host": "localhost",
        "database": "materialize",
        "materializedb_cluster": "analytics",
        "query": {"options": options, "connect_timeout": "10"},
    }
    original = deepcopy(parameters)

    uri = spec.build_sqlalchemy_uri(parameters)
    assert make_url(uri).query["options"] == (
        "--statement_timeout=30s --application_name=superset --cluster=analytics"
    )
    reloaded = spec.get_parameters_from_uri(uri)
    assert reloaded["materializedb_cluster"] == "analytics"
    assert reloaded["query"] == {
        "options": "--statement_timeout=30s --application_name=superset",
        "connect_timeout": "10",
    }
    assert parameters == original
    assert spec.build_sqlalchemy_uri(reloaded) == uri


@pytest.mark.parametrize(
    "options,cluster,remaining",
    [
        ("--cluster=a --statement_timeout=30s", "a", "--statement_timeout=30s"),
        ("--statement_timeout=30s --cluster=a", "a", "--statement_timeout=30s"),
        ("-c cluster=a -c application_name=b", "a", "-c application_name=b"),
        ("-ccluster=a --cluster=b", "b", ""),
        (
            r"--cluster=a\ b\\c --application_name=x\ y",
            "a b\\c",
            r"--application_name=x\ y",
        ),
        ("--cluster= --statement_timeout=30s", "", "--statement_timeout=30s"),
    ],
)
def test_extract_cluster_from_options(
    options: str, cluster: str, remaining: str
) -> None:
    """Extract cluster settings anywhere without consuming adjacent options."""
    uri = make_url("materialize+psycopg2://u@localhost:6875/materialize").set(
        query={"options": options}
    )
    parameters = spec.get_parameters_from_uri(str(uri))
    assert parameters["materializedb_cluster"] == cluster
    assert parameters["query"] == ({"options": remaining} if remaining else {})


def test_options_without_cluster_are_preserved() -> None:
    """Keep user options unchanged when no cluster needs extracting."""
    options = r"--application_name=my\ app  --statement_timeout=30s"
    parameters: BasicParametersType = {
        "host": "localhost",
        "database": "materialize",
        "query": {"options": options},
    }
    reloaded = spec.get_parameters_from_uri(spec.build_sqlalchemy_uri(parameters))
    assert "materializedb_cluster" not in reloaded
    assert reloaded["query"] == {"options": options}


@pytest.mark.parametrize("cluster", ["analytics", "analytics & reporting", r"a\b"])
def test_cluster_round_trip(cluster: str) -> None:
    """Reopening and resaving a form-built connection keeps its cluster."""
    parameters: BasicParametersType = {
        "host": "localhost",
        "database": "materialize",
        "materializedb_cluster": cluster,
    }

    reloaded = spec.get_parameters_from_uri(spec.build_sqlalchemy_uri(parameters))

    assert reloaded["materializedb_cluster"] == cluster
    assert spec.build_sqlalchemy_uri(reloaded) == spec.build_sqlalchemy_uri(parameters)


@pytest.mark.parametrize("port", [None, "", 16875])
@pytest.mark.parametrize("cluster", [None, "", "analytics"])
def test_parameters_schema_and_uri(port: int | str | None, cluster: str | None) -> None:
    """Accept optional form fields and use Materialize's default port."""
    parameters = spec.parameters_schema.load(
        {
            "username": "user",
            "host": "localhost",
            "database": "materialize",
            "port": port,
            "materializedb_cluster": cluster,
        }
    )

    url = make_url(spec.build_sqlalchemy_uri(parameters))

    assert url.port == (16875 if port == 16875 else 6875)
    if cluster:
        assert url.query["options"] == f"--cluster={cluster}"
    else:
        assert "options" not in url.query


@pytest.mark.parametrize("autocommit", [False, True])
def test_prepare_connection(autocommit: bool) -> None:
    """Connections use autocommit without opening or committing a transaction."""
    connection = MagicMock(autocommit=autocommit)

    spec.prepare_connection(connection)

    assert connection.autocommit is True
    connection.commit.assert_not_called()
    connection.rollback.assert_not_called()


@pytest.mark.parametrize(
    "target_type,expected",
    [
        ("Date", "CAST('2019-01-02' AS DATE)"),
        ("DateTime", "CAST('2019-01-02 03:04:05.678900' AS TIMESTAMP)"),
        ("Timestamp", "CAST('2019-01-02 03:04:05.678900' AS TIMESTAMP)"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(target_type: str, expected: str | None) -> None:
    """Datetime literals use Materialize casts for each supported type spelling."""
    assert_convert_dttm(
        spec, target_type, expected, datetime(2019, 1, 2, 3, 4, 5, 678900)
    )


def test_get_schema_names() -> None:
    """Hide system schemas while retaining similarly named user schemas."""
    inspector = MagicMock()
    connection = inspector.engine.connect.return_value.__enter__.return_value
    connection.execute.return_value = [
        (name,)
        for name in [
            "public",
            "analytics",
            "pg_catalog",
            "pg_temp_1",
            "mz_catalog",
            "mz_internal",
            "information_schema",
            "pgdata",
            "mzdata",
        ]
    ]

    assert spec.get_schema_names(inspector) == {
        "public",
        "analytics",
        "pgdata",
        "mzdata",
    }
    connection.execute.assert_called_once()
    assert str(connection.execute.call_args.args[0]) == (
        "SELECT nspname FROM pg_namespace ORDER BY nspname"
    )


@pytest.fixture
def search_path_database() -> MagicMock:
    """Provide a database with a mock cursor and a configured search path."""
    database = MagicMock()
    connection = database.get_raw_connection.return_value.__enter__.return_value
    cursor = connection.cursor.return_value
    cursor.fetchone.return_value = (
        ["mz_catalog", "analytics", "public"],
        '"$user", analytics, public, future',
        "analyst",
    )
    return database


def test_get_search_path(search_path_database: MagicMock) -> None:
    """Resolve candidate spellings in path order and ignore missing relations."""
    connection = (
        search_path_database.get_raw_connection.return_value.__enter__.return_value
    )
    cursor = connection.cursor.return_value
    cursor.fetchall.return_value = [
        ("public", '"sales"'),
        ("analytics", '"sales"'),
        ("public", '"Sales"'),
        ("analytics", '"Sales"'),
        ("public", '"a""b"'),
        ("mz_catalog", '"mz_tables"'),
    ]

    schemas, resolved = spec.get_search_path(
        search_path_database, "materialize", ["Sales", 'a"b', "mz_tables", "missing"]
    )

    assert schemas == ["mz_catalog", "analytics", "public", "analyst", "future"]
    assert resolved == {
        "Sales": ["analytics"],
        'a"b': ["public"],
        "mz_tables": ["mz_catalog"],
    }
    search_path_database.get_raw_connection.assert_called_once_with(
        catalog="materialize"
    )
    sql, parameters = cursor.execute.call_args.args
    assert "mz_catalog.mz_relations" in sql
    assert "d.name = current_database() OR s.database_id IS NULL" in sql
    assert parameters == (
        ['"Sales"', '"sales"', '"a""b"', '"mz_tables"', '"missing"'],
        ["mz_catalog", "analytics", "public"],
    )


def test_get_search_path_without_tables(search_path_database: MagicMock) -> None:
    """Include configured missing schemas without issuing a relation lookup."""
    assert spec.get_search_path(search_path_database, None) == (
        ["mz_catalog", "analytics", "public", "analyst", "future"],
        {},
    )
    connection = (
        search_path_database.get_raw_connection.return_value.__enter__.return_value
    )
    cursor = connection.cursor.return_value
    cursor.execute.assert_called_once()
    cursor.fetchall.assert_not_called()


@pytest.mark.parametrize("row", [None, ("{public}",)])
def test_get_search_path_invalid_result(
    search_path_database: MagicMock, row: tuple[str] | None
) -> None:
    """Reject unreadable search paths instead of reporting an empty path."""
    connection = (
        search_path_database.get_raw_connection.return_value.__enter__.return_value
    )
    cursor = connection.cursor.return_value
    cursor.fetchone.return_value = row

    with pytest.raises(ValueError, match="Unexpected search path"):
        spec.get_search_path(search_path_database, None, ["sales"])

    cursor.fetchall.assert_not_called()


def test_get_search_path_failure(search_path_database: MagicMock) -> None:
    """Propagate catalog failures to the caller."""
    connection = (
        search_path_database.get_raw_connection.return_value.__enter__.return_value
    )
    connection.cursor.return_value.execute.side_effect = RuntimeError(
        "catalog unavailable"
    )

    with pytest.raises(RuntimeError, match="catalog unavailable"):
        spec.get_search_path(search_path_database, None)


def test_get_cancel_query_id() -> None:
    """Finish the PID lookup transaction before returning control to the caller."""
    cursor = MagicMock()
    cursor.fetchone.return_value = (12345,)

    assert spec.get_cancel_query_id(cursor, MagicMock()) == 12345
    assert cursor.mock_calls == [
        call.execute("SELECT pg_backend_pid()"),
        call.fetchone(),
        call.connection.commit(),
    ]


def test_cancel_query() -> None:
    """Cancel the query on the connection identified by the saved ID."""
    cursor = MagicMock()
    cursor.fetchone.return_value = (True,)

    assert spec.cancel_query(cursor, MagicMock(), "12345") is True
    cursor.execute.assert_called_once_with("SELECT pg_cancel_backend(%s)", (12345,))


def test_cancel_query_unknown_connection() -> None:
    """Report False when Materialize has no connection with the given ID."""
    cursor = MagicMock()
    cursor.fetchone.return_value = (False,)

    assert spec.cancel_query(cursor, MagicMock(), "12345") is False


@pytest.mark.parametrize("query_id", ["", "abc", "12-34"])
def test_cancel_query_invalid_id(query_id: str) -> None:
    """Reject invalid backend identifiers without executing a query."""
    cursor = MagicMock()

    assert spec.cancel_query(cursor, MagicMock(), query_id) is False
    cursor.execute.assert_not_called()


def test_cancel_query_failure() -> None:
    """Report cancellation failures without propagating driver exceptions."""
    cursor = MagicMock()
    cursor.execute.side_effect = RuntimeError("connection closed")

    assert spec.cancel_query(cursor, MagicMock(), "12345") is False
