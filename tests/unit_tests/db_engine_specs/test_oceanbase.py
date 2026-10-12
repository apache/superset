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

import importlib
import sys
import types as python_types
from typing import Any, Optional
from unittest.mock import MagicMock

import pytest
from sqlalchemy import JSON, types
from sqlalchemy.exc import NoSuchTableError, ProgrammingError

from superset.db_engine_specs.oceanbase import ARRAY, MAP, NUMBER, NUMERIC
from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import assert_column_spec


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        # Numeric
        ("tinyint", types.SMALLINT, None, GenericDataType.NUMERIC, False),
        ("largeint", types.BIGINT, None, GenericDataType.NUMERIC, False),
        ("decimal(38,18)", types.DECIMAL, None, GenericDataType.NUMERIC, False),
        ("number(38,18)", NUMBER, None, GenericDataType.NUMERIC, False),
        ("numeric(38,18)", NUMERIC, None, GenericDataType.NUMERIC, False),
        ("double", types.FLOAT, None, GenericDataType.NUMERIC, False),
        # String
        ("char(10)", types.CHAR, None, GenericDataType.STRING, False),
        ("varchar(65533)", types.VARCHAR, None, GenericDataType.STRING, False),
        ("binary", types.BINARY, None, GenericDataType.STRING, False),
        ("text", types.TEXT, None, GenericDataType.STRING, False),
        # Complex type
        ("array<varchar(65533)>", ARRAY, None, GenericDataType.STRING, False),
        ("map<string,int>", MAP, None, GenericDataType.STRING, False),
        ("json", JSON, None, GenericDataType.STRING, False),
        ("jsonb", JSON, None, GenericDataType.STRING, False),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[types.TypeEngine],
    attrs: Optional[dict[str, Any]],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    from superset.db_engine_specs.oceanbase import (
        OceanBaseEngineSpec as spec,  # noqa: N813
    )

    assert_column_spec(spec, native_type, sqla_type, attrs, generic_type, is_dttm)


def install_fake_oceanbase_py(monkeypatch: pytest.MonkeyPatch) -> Any:
    """
    Stub a minimal ``oceanbase_py`` package replicating the real dialect's
    bugs (``Connection.execute(raw_string)``, no not-found handling) into
    ``sys.modules`` and return its (not yet patched) dialect class.

    This lets the tests exercise the actual patch logic without needing the
    real driver installed -- it pins ``sqlalchemy<2``, incompatible with this
    repo's own pin, so it's never part of the base dev environment (see
    ``requirements/development.in``); CI installs it standalone, with
    ``--no-deps``, only for the dedicated nightly testcontainers job.
    """

    class FakeIdentifierPreparer:
        @staticmethod
        def quote_identifier(name: str) -> str:
            return f"`{name}`"

    class FakeOceanBaseDialect:
        default_schema_name = "test_schema"
        identifier_preparer = FakeIdentifierPreparer()

        def _get_default_schema_name(self, connection: Any) -> str:
            return self.default_schema_name

        def has_table(
            self, connection: Any, table_name: str, schema: Optional[str] = None
        ) -> bool:
            # The original, unpatched method: passes a raw string straight
            # to Connection.execute() (rejected outright by SQLAlchemy 2.0)
            # and never catches the "table doesn't exist" error, so it can
            # only ever return True.
            connection.execute(f"DESCRIBE {table_name}")
            return True

        def get_columns(
            self, connection: Any, table_name: str, schema: Optional[str] = None
        ) -> list[dict[str, Any]]:
            connection.execute(f"SHOW COLUMNS FROM {table_name}")
            return []

    datatype_module = python_types.ModuleType("oceanbase_py.sqlalchemy.datatype")
    parsed_types: list[str] = []

    def parse_sql_type(native_type: str) -> types.TypeEngine:
        parsed_types.append(native_type)
        return types.INTEGER()

    datatype_module.parse_sql_type = parse_sql_type  # type: ignore[attr-defined]
    datatype_module.parsed_types = parsed_types  # type: ignore[attr-defined]

    dialect_module = python_types.ModuleType("oceanbase_py.sqlalchemy.dialect")
    dialect_module.OceanBaseDialect = FakeOceanBaseDialect  # type: ignore[attr-defined]

    sqlalchemy_module = python_types.ModuleType("oceanbase_py.sqlalchemy")
    sqlalchemy_module.datatype = datatype_module  # type: ignore[attr-defined]
    sqlalchemy_module.dialect = dialect_module  # type: ignore[attr-defined]

    package_module = python_types.ModuleType("oceanbase_py")
    package_module.sqlalchemy = sqlalchemy_module  # type: ignore[attr-defined]

    for name, module in {
        "oceanbase_py": package_module,
        "oceanbase_py.sqlalchemy": sqlalchemy_module,
        "oceanbase_py.sqlalchemy.datatype": datatype_module,
        "oceanbase_py.sqlalchemy.dialect": dialect_module,
    }.items():
        monkeypatch.setitem(sys.modules, name, module)

    return FakeOceanBaseDialect


@pytest.fixture
def oceanbase_dialect(monkeypatch: pytest.MonkeyPatch) -> type:
    """
    The fake dialect with ``monkeypatch_dialect()`` run against it.
    """
    fake_dialect = install_fake_oceanbase_py(monkeypatch)

    from superset.db_engine_specs.oceanbase import monkeypatch_dialect

    monkeypatch_dialect()
    return fake_dialect


def test_monkeypatch_is_applied_at_import_time(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Nothing in the app calls ``monkeypatch_dialect()`` explicitly: real
    imports (and the testcontainers suite) rely on the module-level call at
    the bottom of ``superset.db_engine_specs.oceanbase``. Re-import the
    module with the fake driver in place and check the dialect comes out
    patched without this test ever calling ``monkeypatch_dialect()`` itself.
    """
    fake_dialect = install_fake_oceanbase_py(monkeypatch)
    unpatched_has_table = fake_dialect.has_table
    unpatched_get_columns = fake_dialect.get_columns

    monkeypatch.delitem(sys.modules, "superset.db_engine_specs.oceanbase")
    reimported = importlib.import_module("superset.db_engine_specs.oceanbase")

    assert fake_dialect.has_table is not unpatched_has_table
    assert fake_dialect.get_columns is not unpatched_get_columns
    assert fake_dialect.has_table.__module__ == reimported.__name__
    assert fake_dialect.get_columns.__module__ == reimported.__name__

    connection = MagicMock()
    connection.exec_driver_sql.return_value.first.return_value = ("id",)
    assert fake_dialect().has_table(connection, "pilot_types") is True
    connection.execute.assert_not_called()


def test_monkeypatch_has_table_uses_exec_driver_sql(
    oceanbase_dialect: type,
) -> None:
    """
    The patched has_table() must use exec_driver_sql(), the call every other
    raw-SQL method in the real dialect already uses -- the original's
    connection.execute(raw_string) is exactly what SQLAlchemy 2.0 rejects
    with ObjectNotExecutableError.
    """
    dialect = oceanbase_dialect()
    connection = MagicMock()
    connection.exec_driver_sql.return_value.first.return_value = ("id",)

    assert dialect.has_table(connection, "pilot_types") is True
    connection.exec_driver_sql.assert_called_once_with(
        "DESCRIBE `test_schema`.`pilot_types`"
    )
    connection.execute.assert_not_called()


def test_monkeypatch_has_table_returns_false_for_missing_table(
    oceanbase_dialect: type,
) -> None:
    """
    DESCRIBE on a nonexistent table raises 1146 ("table doesn't exist")
    rather than returning an empty result set. The unpatched method never
    catches this at all, so it can only ever return True -- breaking
    MetaData.create_all()'s default checkfirst=True, which relies on
    has_table() returning False for a table that isn't there yet.
    """
    dialect = oceanbase_dialect()
    connection = MagicMock()
    connection.exec_driver_sql.side_effect = ProgrammingError(
        "DESCRIBE `missing_table`", {}, Exception(1146, "Table doesn't exist")
    )

    assert dialect.has_table(connection, "missing_table") is False


def test_monkeypatch_has_table_reraises_other_programming_errors(
    oceanbase_dialect: type,
) -> None:
    dialect = oceanbase_dialect()
    connection = MagicMock()
    connection.exec_driver_sql.side_effect = ProgrammingError(
        "DESCRIBE `t`", {}, Exception(1064, "You have an error in your SQL syntax")
    )

    with pytest.raises(ProgrammingError):
        dialect.has_table(connection, "t")


def test_monkeypatch_get_columns_raises_for_missing_table(
    oceanbase_dialect: type,
) -> None:
    dialect = oceanbase_dialect()
    connection = MagicMock()
    connection.exec_driver_sql.side_effect = ProgrammingError(
        "DESCRIBE `missing_table`", {}, Exception(1146, "Table doesn't exist")
    )

    with pytest.raises(NoSuchTableError):
        dialect.get_columns(connection, "missing_table")


def test_monkeypatch_get_columns_uses_exec_driver_sql(
    oceanbase_dialect: type,
) -> None:
    dialect = oceanbase_dialect()
    connection = MagicMock()
    describe_result = MagicMock()
    describe_result.first.return_value = ("id",)
    column_record = MagicMock(Field="id", Type="int", Null="NO", Default=None)
    connection.exec_driver_sql.side_effect = [describe_result, [column_record]]

    columns = dialect.get_columns(connection, "pilot_types")

    assert len(columns) == 1
    assert isinstance(columns[0]["type"], types.INTEGER)
    assert {k: v for k, v in columns[0].items() if k != "type"} == {
        "name": "id",
        "nullable": False,
        "default": None,
    }
    assert sys.modules["oceanbase_py.sqlalchemy.datatype"].parsed_types == ["int"]
    connection.exec_driver_sql.assert_any_call(
        "SHOW COLUMNS FROM `test_schema`.`pilot_types`"
    )
    connection.execute.assert_not_called()


def test_monkeypatch_is_a_noop_without_the_driver_installed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    oceanbase_py is an optional dependency: importing
    superset.db_engine_specs.oceanbase, and therefore running
    monkeypatch_dialect(), must not blow up in an environment that doesn't
    have it installed (the base dev environment, for instance -- see
    requirements/development.in).
    """
    monkeypatch.setitem(sys.modules, "oceanbase_py", None)
    monkeypatch.setitem(sys.modules, "oceanbase_py.sqlalchemy", None)
    monkeypatch.setitem(sys.modules, "oceanbase_py.sqlalchemy.dialect", None)

    from superset.db_engine_specs.oceanbase import monkeypatch_dialect

    monkeypatch_dialect()  # should not raise
def test_oceanbase_properties() -> None:
    from superset.db_engine_specs.mysql import MySQLEngineSpec
    from superset.db_engine_specs.oceanbase import OceanBaseEngineSpec

    assert OceanBaseEngineSpec.engine == "oceanbase"
    assert OceanBaseEngineSpec.engine_name == "OceanBase"
    assert OceanBaseEngineSpec.default_driver == "oceanbase"
    assert OceanBaseEngineSpec.max_column_name_length == 128
    assert issubclass(OceanBaseEngineSpec, MySQLEngineSpec)
    assert OceanBaseEngineSpec._extended_aggregations == {}


def test_oceanbase_metadata() -> None:
    from superset.db_engine_specs.oceanbase import OceanBaseEngineSpec

    metadata = OceanBaseEngineSpec.metadata
    assert "OceanBase is a distributed relational database" in metadata["description"]
    assert metadata["logo"] == "oceanbase.svg"
    assert metadata["homepage_url"] == "https://www.oceanbase.com/"
