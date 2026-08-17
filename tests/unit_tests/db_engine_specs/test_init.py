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
