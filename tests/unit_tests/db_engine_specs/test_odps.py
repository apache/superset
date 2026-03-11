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
import logging
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.dialects import sqlite

from superset.db_engine_specs.odps import OdpsBaseEngineSpec, OdpsEngineSpec
from superset.sql.parse import Partition, Table


def test_odps_base_engine_spec_get_table_metadata_raises() -> None:
    """OdpsBaseEngineSpec.get_table_metadata must not be called directly."""
    with pytest.raises(NotImplementedError):
        OdpsBaseEngineSpec.get_table_metadata(
            database=MagicMock(),
            table=Table("my_table", None, None),
        )


def test_odps_engine_spec_select_star_no_partition() -> None:
    """select_star for a non-partitioned ODPS table produces a plain SELECT *."""
    database = MagicMock()
    database.backend = "odps"
    database.get_columns.return_value = []
    database.compile_sqla_query = lambda query, catalog, schema: str(
        query.compile(dialect=sqlite.dialect())
    )
    dialect = sqlite.dialect()

    sql = OdpsEngineSpec.select_star(
        database=database,
        table=Table("my_table", None, None),
        dialect=dialect,
        limit=100,
        show_cols=False,
        indent=False,
        latest_partition=False,
        partition=None,
    )

    assert "SELECT" in sql
    assert "my_table" in sql


def test_odps_engine_spec_select_star_with_partition() -> None:
    """select_star for a partitioned ODPS table adds a WHERE clause."""
    database = MagicMock()
    database.backend = "odps"
    database.get_columns.return_value = []
    database.compile_sqla_query = lambda query, catalog, schema: str(
        query.compile(dialect=sqlite.dialect())
    )
    dialect = sqlite.dialect()
    partition = Partition(is_partitioned_table=True, partition_column=["month"])

    sql = OdpsEngineSpec.select_star(
        database=database,
        table=Table("my_table", None, None),
        dialect=dialect,
        limit=100,
        show_cols=False,
        indent=False,
        latest_partition=False,
        partition=partition,
    )

    assert "WHERE" in sql


def test_is_odps_partitioned_table_non_odps_backend() -> None:
    """Returns (False, []) immediately for non-ODPS databases; no network call made."""
    from superset.daos.database import DatabaseDAO

    database = MagicMock()
    database.backend = "postgresql"

    result = DatabaseDAO.is_odps_partitioned_table(database, "some_table")

    assert result == (False, [])


def test_is_odps_partitioned_table_missing_pyodps() -> None:
    """Returns (False, []) with a warning when pyodps is not installed."""
    from superset.daos.database import DatabaseDAO

    database = MagicMock()
    database.backend = "odps"
    database.sqlalchemy_uri = (
        "odps://mykey:mysecret@myproject/?endpoint=http://service.odps.test"
    )
    database.password = "mysecret"  # noqa: S105

    with patch.dict("sys.modules", {"odps": None}):
        result = DatabaseDAO.is_odps_partitioned_table(database, "some_table")

    assert result == (False, [])


def test_is_odps_partitioned_table_uri_no_match(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Logs a warning and returns (False, []) when the URI doesn't match the pattern."""
    from superset.daos.database import DatabaseDAO

    database = MagicMock()
    database.backend = "odps"
    database.sqlalchemy_uri = "odps://invalid-uri-format"
    database.password = "secret"  # noqa: S105

    mock_odps_module = MagicMock()
    with patch.dict("sys.modules", {"odps": mock_odps_module}):
        with caplog.at_level(logging.WARNING, logger="superset.daos.database"):
            result = DatabaseDAO.is_odps_partitioned_table(database, "some_table")

    assert result == (False, [])
    assert "did not match" in caplog.text


def test_is_odps_partitioned_table_partitioned(monkeypatch: pytest.MonkeyPatch) -> None:
    """Returns (True, [field_names]) for a partitioned ODPS table."""
    from superset.daos.database import DatabaseDAO

    database = MagicMock()
    database.backend = "odps"
    database.sqlalchemy_uri = (
        "odps://mykey:mysecret@myproject/?endpoint=http://service.odps.test"
    )
    database.password = "mysecret"  # noqa: S105

    mock_partition = MagicMock()
    mock_partition.name = "month"
    mock_table = MagicMock()
    mock_table.exist_partition = True
    mock_table.table_schema.partitions = [mock_partition]

    mock_odps_client = MagicMock()
    mock_odps_client.get_table.return_value = mock_table
    mock_odps_class = MagicMock(return_value=mock_odps_client)

    with patch.dict("sys.modules", {"odps": MagicMock(ODPS=mock_odps_class)}):
        with patch("superset.daos.database.ODPS", mock_odps_class, create=True):
            result = DatabaseDAO.is_odps_partitioned_table(database, "my_table")

    assert result == (True, ["month"])


def test_is_odps_partitioned_table_not_partitioned(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Returns (False, []) for a non-partitioned ODPS table."""
    from superset.daos.database import DatabaseDAO

    database = MagicMock()
    database.backend = "odps"
    database.sqlalchemy_uri = (
        "odps://mykey:mysecret@myproject/?endpoint=http://service.odps.test"
    )
    database.password = "mysecret"  # noqa: S105

    mock_table = MagicMock()
    mock_table.exist_partition = False
    mock_odps_client = MagicMock()
    mock_odps_client.get_table.return_value = mock_table
    mock_odps_class = MagicMock(return_value=mock_odps_client)

    with patch.dict("sys.modules", {"odps": MagicMock(ODPS=mock_odps_class)}):
        result = DatabaseDAO.is_odps_partitioned_table(database, "my_table")

    assert result == (False, [])
