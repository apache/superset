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


import pytest
from pytest_mock import MockerFixture
from sqlalchemy.engine.default import DefaultDialect

from superset.db_engine_specs import get_available_engine_specs


def test_get_available_engine_specs(mocker: MockerFixture) -> None:
    """
    get_available_engine_specs should return all engine specs
    """
    from superset.db_engine_specs.databricks import (
        DatabricksHiveEngineSpec,
        DatabricksNativeEngineSpec,
        DatabricksODBCEngineSpec,
    )

    mocker.patch(
        "superset.db_engine_specs.load_engine_specs",
        return_value=iter(
            [
                DatabricksHiveEngineSpec,
                DatabricksNativeEngineSpec,
                DatabricksODBCEngineSpec,
            ]
        ),
    )

    assert list(get_available_engine_specs().keys()) == [
        DatabricksHiveEngineSpec,
        DatabricksNativeEngineSpec,
        DatabricksODBCEngineSpec,
    ]


def test_get_available_engine_specs_skips_malformed_dialect_entry_point(
    mocker: MockerFixture,
) -> None:
    """
    A third-party ``sqlalchemy.dialects`` entry point that loads successfully but
    does not resolve to a usable dialect (e.g. a module with no ``name`` or a
    named class that does not implement the dialect contract) must be skipped.

    Regression test: an unguarded ``dialect.name`` there aborted the whole
    enumeration with ``AttributeError``, which 500s every page that builds the
    bootstrap payload (e.g. ``/welcome/``), not just that one connector.
    """
    import types

    mocker.patch(
        "superset.db_engine_specs.load_engine_specs",
        return_value=iter([]),
    )

    malformed_ep = mocker.MagicMock()
    malformed_ep.name = "bogus"
    malformed_ep.value = "bogus_pkg:base"
    # ``ep.load()`` returns a module (no ``name`` attribute), as a real
    # ``name = pkg:submodule`` entry point would.
    malformed_ep.load.return_value = types.ModuleType("bogus_pkg.base")

    named_but_invalid_ep = mocker.MagicMock()
    named_but_invalid_ep.name = "named_bogus"
    named_but_invalid_ep.value = "bogus_pkg:NamedButInvalidDialect"
    named_but_invalid_ep.load.return_value = type(
        "NamedButInvalidDialect",
        (),
        {"name": "bogus", "driver": "bogus"},
    )

    def entry_points(group: str) -> list[object]:
        return (
            [malformed_ep, named_but_invalid_ep]
            if group == "sqlalchemy.dialects"
            else []
        )

    mocker.patch(
        "superset.db_engine_specs.entry_points",
        side_effect=entry_points,
    )
    warning = mocker.patch("superset.db_engine_specs.logger.warning")

    # Must not raise (previously ``AttributeError`` on ``dialect.name``).
    available = get_available_engine_specs()

    assert isinstance(available, dict)
    # The malformed entry point is skipped with a warning that identifies it.
    assert any("bogus" in str(call) for call in warning.call_args_list)
    assert any("named_bogus" in str(call) for call in warning.call_args_list)


def test_get_available_engine_specs_keeps_valid_third_party_dialect(
    mocker: MockerFixture,
) -> None:
    """A valid SQLAlchemy 2.0-style dialect is included without calling dbapi()."""
    import sqlalchemy.dialects

    from superset.db_engine_specs.sqlite import SqliteEngineSpec

    class ValidDialect(DefaultDialect):
        name = "sqlite"
        driver = "valid_driver"

    mocker.patch.object(sqlalchemy.dialects, "__all__", [])
    mocker.patch(
        "superset.db_engine_specs.load_engine_specs",
        return_value=iter([SqliteEngineSpec]),
    )
    entry_point = mocker.MagicMock()
    entry_point.load.return_value = ValidDialect
    mocker.patch(
        "superset.db_engine_specs.entry_points",
        return_value=[entry_point],
    )

    available = get_available_engine_specs()

    assert available[SqliteEngineSpec] == {"valid_driver"}


def test_get_available_engine_specs_supports_sqlalchemy_2_native_dialect(
    mocker: MockerFixture,
) -> None:
    """A native SQLAlchemy 2 dialect is discovered through import_dbapi()."""
    import sqlalchemy.dialects

    from superset.db_engine_specs.mysql import MySQLEngineSpec

    class ValidDialect(DefaultDialect):
        driver = "mysqldb"

        @classmethod
        def import_dbapi(cls) -> object:
            return object()

    mocker.patch.object(sqlalchemy.dialects, "__all__", ["mysql"])
    mocker.patch.object(
        sqlalchemy.dialects.registry,
        "load",
        return_value=ValidDialect,
    )
    mocker.patch(
        "superset.db_engine_specs.load_engine_specs",
        return_value=iter([MySQLEngineSpec]),
    )
    mocker.patch(
        "superset.db_engine_specs.entry_points",
        return_value=[],
    )

    available = get_available_engine_specs()

    assert available[MySQLEngineSpec] == {"mysqldb"}


def test_get_available_engine_specs_restores_compiler_operators(
    mocker: MockerFixture,
) -> None:
    """
    A third-party ``sqlalchemy.dialects`` entry point that mutates SQLAlchemy's
    shared, process-global ``compiler.OPERATORS`` mapping on import (as
    ``sqlalchemy-monetdb`` does, in place, rather than subclassing) must not be
    allowed to leak that change into every other dialect for the rest of the
    process.

    Regression test: enumerating a real "monetdb" entry point here (to build the
    "available databases" list) silently changed ``!=`` rendering to ``<>`` for
    postgres/mysql/sqlite/etc. too, for the remainder of the process.
    """
    from sqlalchemy.sql import compiler as sqla_compiler, operators

    mocker.patch(
        "superset.db_engine_specs.load_engine_specs",
        return_value=iter([]),
    )

    pristine = dict(sqla_compiler.OPERATORS)
    assert pristine[operators.ne] != " <> "

    class MisbehavingDialect(DefaultDialect):
        name = "misbehaving"
        driver = "misbehaving_driver"

    def load_and_mutate_globally() -> type[MisbehavingDialect]:
        # Mirrors sqlalchemy-monetdb's `base.py`: grabs a reference to the
        # shared dict (not a copy) and mutates it in place.
        sqla_compiler.OPERATORS[operators.ne] = " <> "
        return MisbehavingDialect

    entry_point = mocker.MagicMock()
    entry_point.name = "misbehaving"
    entry_point.load.side_effect = load_and_mutate_globally
    mocker.patch(
        "superset.db_engine_specs.entry_points",
        return_value=[entry_point],
    )

    try:
        get_available_engine_specs()
        assert sqla_compiler.OPERATORS[operators.ne] == pristine[operators.ne]
    finally:
        sqla_compiler.OPERATORS.clear()
        sqla_compiler.OPERATORS.update(pristine)


@pytest.mark.parametrize("rebind", [True, False], ids=["rebind", "in_place"])
def test_get_available_engine_specs_restores_reserved_words(
    mocker: MockerFixture,
    rebind: bool,
) -> None:
    """
    A third-party ``sqlalchemy.dialects`` entry point that replaces or extends
    SQLAlchemy's shared ``IdentifierPreparer.reserved_words`` set on import (as
    ``kylinpy`` does) must not change identifier quoting for other dialects.

    Regression test: enumerating such an entry point made every dialect relying
    on the generic reserved words quote ordinary column names like ``name``,
    turning them into case-sensitive identifiers that no longer match columns
    on case-folding databases.
    """
    import sqlalchemy as sa
    from sqlalchemy.dialects import postgresql
    from sqlalchemy.sql import compiler as sqla_compiler

    mocker.patch(
        "superset.db_engine_specs.load_engine_specs",
        return_value=iter([]),
    )

    preparer_cls = sqla_compiler.IdentifierPreparer
    pristine_object = preparer_cls.reserved_words
    pristine_words = set(pristine_object)
    assert "name" not in pristine_words

    table = sa.table("t", sa.column("name"), sa.column("user"))
    query = sa.select(table.c.name, table.c.user)

    def render() -> tuple[str, str]:
        return (
            str(query.compile(dialect=DefaultDialect())),
            str(query.compile(dialect=postgresql.dialect())),
        )

    expected = render()
    assert "t.name" in expected[0]

    class MisbehavingDialect(DefaultDialect):
        name = "misbehaving"
        driver = "misbehaving_driver"

    def load_and_mutate_globally() -> type[MisbehavingDialect]:
        if rebind:
            # Mirrors kylinpy's ``sqla_dialect.py``: rebinds the attribute on
            # the shared base class from inside a subclass body.
            preparer_cls.reserved_words = {"name", "NAME"}
        preparer_cls.reserved_words.update({"name", "__timestamp"})
        return MisbehavingDialect

    entry_point = mocker.MagicMock()
    entry_point.name = "misbehaving"
    entry_point.load.side_effect = load_and_mutate_globally
    mocker.patch(
        "superset.db_engine_specs.entry_points",
        return_value=[entry_point],
    )

    try:
        get_available_engine_specs()
        assert preparer_cls.reserved_words is pristine_object
        assert preparer_cls.reserved_words == pristine_words
        assert sqla_compiler.RESERVED_WORDS == pristine_words
        assert render() == expected
    finally:
        preparer_cls.reserved_words = pristine_object
        pristine_object.clear()
        pristine_object.update(pristine_words)


@pytest.mark.parametrize(
    "app",
    [{"DBS_AVAILABLE_DENYLIST": {"databricks": {"pyhive", "pyodbc"}}}],
    indirect=True,
)
def test_get_available_engine_specs_with_denylist(mocker: MockerFixture) -> None:
    """
    The denylist removes items from the db engine spec list
    """
    from superset.db_engine_specs.databricks import (
        DatabricksHiveEngineSpec,
        DatabricksNativeEngineSpec,
        DatabricksODBCEngineSpec,
    )

    mocker.patch(
        "superset.db_engine_specs.load_engine_specs",
        return_value=iter(
            [
                DatabricksHiveEngineSpec,
                DatabricksNativeEngineSpec,
                DatabricksODBCEngineSpec,
            ]
        ),
    )
    available = get_available_engine_specs()
    assert list(available.keys()) == [DatabricksNativeEngineSpec]
