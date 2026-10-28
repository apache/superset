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
from datetime import datetime
from typing import Any, Optional, Union
from unittest import mock

import pytest
from sqlalchemy import column, types
from sqlalchemy.dialects import oracle
from sqlalchemy.dialects.oracle import DATE, NVARCHAR, VARCHAR
from sqlalchemy.sql import quoted_name

from superset.sql.parse import LimitMethod
from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import (
    assert_column_spec,
    assert_convert_dttm,
)
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "column_name,expected_result",
    [
        # SHA-256 hash of 129 'a' characters with default HASH_ALGORITHM
        ("a" * 129, "c12cb024a2e5551cca0e08fce8f1c5e314555cc3fef6329ee994a3db752166ae"),
        ("snake_label", "snake_label"),
        ("camelLabel", "camelLabel"),
    ],
)
def test_oracle_sqla_column_name_length_exceeded(
    column_name: str, expected_result: Union[str, quoted_name]
) -> None:
    from superset.db_engine_specs.oracle import OracleEngineSpec

    label = OracleEngineSpec.make_label_compatible(column_name)
    assert isinstance(label, quoted_name)
    assert label.quote is True
    assert label == expected_result


def test_oracle_time_expression_reserved_keyword_1m_grain() -> None:
    from superset.db_engine_specs.oracle import OracleEngineSpec

    col = column("decimal")
    expr = OracleEngineSpec.get_timestamp_expr(col, None, "P1M")
    result = str(expr.compile(dialect=oracle.dialect()))
    assert result == "TRUNC(CAST(\"decimal\" as DATE), 'MONTH')"


@pytest.mark.parametrize(
    "sqla_type,expected_result",
    [
        (DATE(), "DATE"),
        (VARCHAR(length=255), "VARCHAR(255 CHAR)"),
        (VARCHAR(length=255, collation="utf8"), "VARCHAR(255 CHAR)"),
        (NVARCHAR(length=128), "NVARCHAR2(128)"),
    ],
)
def test_column_datatype_to_string(
    sqla_type: types.TypeEngine, expected_result: str
) -> None:
    from superset.db_engine_specs.oracle import OracleEngineSpec

    assert (
        OracleEngineSpec.column_datatype_to_string(sqla_type, oracle.dialect())
        == expected_result
    )


def test_fetch_data_no_description() -> None:
    from superset.db_engine_specs.oracle import OracleEngineSpec

    cursor = mock.MagicMock()
    cursor.description = []
    assert OracleEngineSpec.fetch_data(cursor) == []


def test_fetch_data() -> None:
    from superset.db_engine_specs.oracle import OracleEngineSpec

    cursor = mock.MagicMock()
    result = ["a", "b"]
    cursor.fetchall.return_value = result
    assert OracleEngineSpec.fetch_data(cursor) == result


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "TO_DATE('2019-01-02', 'YYYY-MM-DD')"),
        ("DateTime", """TO_DATE('2019-01-02T03:04:05', 'YYYY-MM-DD"T"HH24:MI:SS')"""),
        (
            "TimeStamp",
            """TO_TIMESTAMP('2019-01-02T03:04:05.678900', 'YYYY-MM-DD"T"HH24:MI:SS.ff6')""",  # noqa: E501
        ),
        ("Other", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.oracle import OracleEngineSpec as spec  # noqa: N813

    assert_convert_dttm(spec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    "name,expected_result",
    [
        ("col", "COL"),
        ("Col", "Col"),
        ("COL", "COL"),
    ],
)
def test_denormalize_name(name: str, expected_result: str):
    from superset.db_engine_specs.oracle import OracleEngineSpec as spec  # noqa: N813

    assert spec.denormalize_name(oracle.dialect(), name) == expected_result


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        # Oracle-native types, as reflected by SQLAlchemy's Oracle dialect
        ("NUMBER", types.Numeric, None, GenericDataType.NUMERIC, False),
        ("NUMBER(10, 2)", types.Numeric, None, GenericDataType.NUMERIC, False),
        ("NUMBER(19, 0)", types.Numeric, None, GenericDataType.NUMERIC, False),
        ("BINARY_DOUBLE", types.Float, None, GenericDataType.NUMERIC, False),
        ("BINARY_FLOAT", types.Float, None, GenericDataType.NUMERIC, False),
        ("CLOB", types.Text, None, GenericDataType.STRING, False),
        ("NCLOB", types.Text, None, GenericDataType.STRING, False),
        ("LONG", types.Text, None, GenericDataType.STRING, False),
        ("long", types.Text, None, GenericDataType.STRING, False),
        # types already covered by the base mappings keep their behavior
        ("INTEGER", types.Integer, None, GenericDataType.NUMERIC, False),
        ("DOUBLE PRECISION", types.Float, None, GenericDataType.NUMERIC, False),
        ("VARCHAR(40 CHAR)", types.String, None, GenericDataType.STRING, False),
        ("DATE", types.Date, None, GenericDataType.TEMPORAL, True),
        ("TIMESTAMP", types.TIMESTAMP, None, GenericDataType.TEMPORAL, True),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[types.TypeEngine],
    attrs: Optional[dict[str, Any]],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    """Map Oracle-native types and preserve the base numeric, text and date mappings."""
    from superset.db_engine_specs.oracle import OracleEngineSpec

    assert_column_spec(
        OracleEngineSpec, native_type, sqla_type, attrs, generic_type, is_dttm
    )


@pytest.mark.parametrize(
    "native_type",
    [
        "BLOB",
        "RAW(16)",
        "LONG RAW",
        "long raw",
        "NUMBERING",
        "BINARY_FLOATING",
        "CLOBBER",
        "NCLOBS",
    ],
)
def test_get_column_spec_unmapped_types(native_type: str) -> None:
    """Leave binary types and unrelated names sharing mapped prefixes unmapped."""
    from superset.db_engine_specs.oracle import OracleEngineSpec

    assert OracleEngineSpec.get_column_spec(native_type) is None


def test_get_cancel_query_id() -> None:
    from superset.db_engine_specs.oracle import OracleEngineSpec
    from superset.models.sql_lab import Query

    cursor = mock.Mock()
    cursor.fetchone.return_value = (162, 53643, 1)
    assert OracleEngineSpec.get_cancel_query_id(cursor, Query()) == "162,53643,1"
    assert "CURRENT_SESSION_SERIAL" in cursor.execute.call_args[0][0]


def test_get_cancel_query_id_failed() -> None:
    from superset.db_engine_specs.oracle import OracleEngineSpec
    from superset.models.sql_lab import Query

    cursor = mock.Mock()
    cursor.execute.side_effect = Exception("ORA-00904")
    assert OracleEngineSpec.get_cancel_query_id(cursor, Query()) is None


def test_cancel_query() -> None:
    from superset.db_engine_specs.oracle import OracleEngineSpec
    from superset.models.sql_lab import Query

    cursor = mock.Mock()
    assert OracleEngineSpec.cancel_query(cursor, Query(), "162,53643,1") is True
    cursor.execute.assert_called_once_with("ALTER SYSTEM CANCEL SQL '162, 53643, @1'")


def test_cancel_query_failed() -> None:
    from superset.db_engine_specs.oracle import OracleEngineSpec
    from superset.models.sql_lab import Query

    cursor = mock.Mock()
    cursor.execute.side_effect = Exception("ORA-01031: insufficient privileges")
    assert OracleEngineSpec.cancel_query(cursor, Query(), "162,53643,1") is False


@pytest.mark.parametrize("cancel_query_id", ["1,2", "1,2,1'; --", "a,b,c", ""])
def test_cancel_query_invalid_id(cancel_query_id: str) -> None:
    from superset.db_engine_specs.oracle import OracleEngineSpec
    from superset.models.sql_lab import Query

    cursor = mock.Mock()
    assert OracleEngineSpec.cancel_query(cursor, Query(), cancel_query_id) is False
    cursor.execute.assert_not_called()


@pytest.fixture
def server_versions() -> Any:
    """Start each test with no cached Oracle server versions."""
    from superset.db_engine_specs import oracle as oracle_spec

    oracle_spec._server_versions.clear()
    yield oracle_spec._server_versions
    oracle_spec._server_versions.clear()


def mock_oracle_database(
    version: Any = None,
    server_version_info: Any = None,
    error: Exception | None = None,
) -> mock.MagicMock:
    """A database whose engine reports `server_version_info` when connected."""
    database = mock.MagicMock(id=1, sqlalchemy_uri="oracle+oracledb://u@h:1521/s")
    database.get_extra.return_value = {} if version is None else {"version": version}
    engine = database.get_sqla_engine.return_value.__enter__.return_value
    # The engine hasn't connected yet, so SQLAlchemy doesn't know the version.
    engine.dialect.server_version_info = None
    if error is not None:
        engine.connect.side_effect = error
    connection = engine.connect.return_value.__enter__.return_value
    connection.dialect.server_version_info = server_version_info
    return database


@pytest.mark.parametrize(
    "version, expected",
    [
        ("11g", 30),
        ("11.2.0.4", 30),
        ("12.1.0.2", 30),
        ("12c", 30),
        ("12.2.0.1", 128),
        ("19c", 128),
        (None, 128),
    ],
)
def test_get_max_column_name_length_configured_version(
    version: Any, expected: int, server_versions: Any
) -> None:
    from superset.db_engine_specs.oracle import OracleEngineSpec

    database = mock_oracle_database(version=version)
    assert OracleEngineSpec.get_max_column_name_length(database) == expected
    if version is not None:
        database.get_sqla_engine.assert_not_called()


@pytest.mark.parametrize(
    "version, expected_length",
    [("11.2.0.4", 30), ("12.2.0.1", 40)],
)
def test_make_label_compatible_uses_database_identifier_limit(
    version: str, expected_length: int, server_versions: Any
) -> None:
    from superset.db_engine_specs.oracle import OracleEngineSpec

    database = mock_oracle_database(version=version)
    label = "x" * 40

    compatible_label = OracleEngineSpec.make_label_compatible(label, database)

    assert len(compatible_label) == expected_length


@pytest.mark.parametrize(
    "version, max_bytes",
    [("11.2.0.4", 30), ("12.2.0.1", 128)],
)
def test_make_label_compatible_uses_oracle_identifier_bytes(
    version: str, max_bytes: int, server_versions: Any
) -> None:
    from superset.db_engine_specs.oracle import OracleEngineSpec

    database = mock_oracle_database(version=version)
    label = "é" * (max_bytes // 2 + 1)

    compatible_label = OracleEngineSpec.make_label_compatible(label, database)

    assert len(str(compatible_label).encode("utf-8")) <= max_bytes


@pytest.mark.parametrize(
    "version, expected",
    [
        ("10g", LimitMethod.WRAP_ROWNUM),
        ("11g", LimitMethod.WRAP_ROWNUM),
        ("11.2.0.4", LimitMethod.WRAP_ROWNUM),
        (" 11", LimitMethod.WRAP_ROWNUM),
        (11, LimitMethod.WRAP_ROWNUM),
        ("12c", LimitMethod.FORCE_LIMIT),
        ("12.1.0.2", LimitMethod.FORCE_LIMIT),
        ("19c", LimitMethod.FORCE_LIMIT),
        ("23ai", LimitMethod.FORCE_LIMIT),
    ],
)
def test_get_limit_method_configured_version(
    version: Any, expected: LimitMethod, server_versions: Any
) -> None:
    """
    A version set in the DB extra decides the limit without connecting.
    """
    from superset.db_engine_specs.oracle import OracleEngineSpec

    database = mock_oracle_database(version=version)
    assert OracleEngineSpec.get_limit_method(database) == expected
    database.get_sqla_engine.assert_not_called()


@pytest.mark.parametrize(
    "version, server_version_info, expected",
    [
        (None, (11, 2, 0, 2, 0), LimitMethod.WRAP_ROWNUM),
        ("", (10, 2, 0, 5), LimitMethod.WRAP_ROWNUM),
        ("latest", (11, 2, 0, 4), LimitMethod.WRAP_ROWNUM),
        (None, (12, 1, 0, 2), LimitMethod.FORCE_LIMIT),
        (None, (23, 26, 3, 0, 0), LimitMethod.FORCE_LIMIT),
    ],
)
def test_get_limit_method_detected_version(
    version: Any,
    server_version_info: tuple[int, ...],
    expected: LimitMethod,
    server_versions: Any,
) -> None:
    """
    Without a usable configured version, the server version is read once.
    """
    from superset.db_engine_specs.oracle import OracleEngineSpec

    database = mock_oracle_database(version, server_version_info)
    assert OracleEngineSpec.get_limit_method(database) == expected
    assert OracleEngineSpec.get_limit_method(database) == expected
    database.get_sqla_engine.assert_called_once_with()


def test_get_limit_method_unknown_version(server_versions: Any) -> None:
    """
    If the version can't be read, keep `FETCH FIRST` and try again next time.
    """
    from superset.db_engine_specs.oracle import OracleEngineSpec

    unreachable = mock_oracle_database(error=Exception("ORA-12541: no listener"))
    assert OracleEngineSpec.get_limit_method(unreachable) == LimitMethod.FORCE_LIMIT
    assert OracleEngineSpec.get_limit_method(unreachable) == LimitMethod.FORCE_LIMIT
    assert unreachable.get_sqla_engine.call_count == 2

    unreported = mock_oracle_database(server_version_info=None)
    assert OracleEngineSpec.get_limit_method(unreported) == LimitMethod.FORCE_LIMIT
    assert server_versions == {}


def test_get_limit_method_reuses_connected_engine(server_versions: Any) -> None:
    """
    An engine that has connected already knows the version, so no new connection.
    """
    from superset.db_engine_specs.oracle import OracleEngineSpec

    database = mock_oracle_database()
    engine = database.get_sqla_engine.return_value.__enter__.return_value
    engine.dialect.server_version_info = (11, 2, 0, 4, 0)

    assert OracleEngineSpec.get_limit_method(database) == LimitMethod.WRAP_ROWNUM
    engine.connect.assert_not_called()


def test_register_engine_events_compiles_rownum_until_connected() -> None:
    """
    Before its first connection, SQLAlchemy can't tell 11g from 12c, so a new
    engine compiles limits with `ROWNUM`, which every release accepts.
    """
    from sqlalchemy import select, table

    from superset.db_engine_specs.oracle import OracleEngineSpec

    dialect = oracle.dialect()
    query = select(column("n")).select_from(table("t")).limit(5)
    assert "FETCH FIRST" in str(query.compile(dialect=dialect))

    OracleEngineSpec.register_engine_events(mock.Mock(dialect=dialect))

    compiled = str(
        query.compile(dialect=dialect, compile_kwargs={"literal_binds": True})
    )
    assert "ROWNUM <= 5" in compiled
    assert "FETCH FIRST" not in compiled
    # The first connection decides again from the server version.
    assert dialect.enable_offset_fetch is True


def test_register_engine_events_ignores_other_dialects() -> None:
    """
    Only SQLAlchemy's Oracle dialect has the `FETCH FIRST` switch.
    """
    from sqlalchemy.dialects import sqlite

    from superset.db_engine_specs.oracle import OracleEngineSpec

    dialect = sqlite.dialect()
    OracleEngineSpec.register_engine_events(mock.Mock(dialect=dialect))
    assert not hasattr(dialect, "_supports_offset_fetch")
