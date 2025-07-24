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
# pylint: disable=import-outside-toplevel, unused-argument, redefined-outer-name, invalid-name

from functools import partial
from typing import Any, TYPE_CHECKING

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import db

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable

FULL_DTTM_DEFAULTS_EXAMPLE = {
    "main_dttm_col": "id",
    "dttm_columns": {
        "dttm": {
            "python_date_format": "epoch_s",
            "expression": "CAST(dttm as INTEGER)",
        },
        "id": {"python_date_format": "epoch_ms"},
        "month": {
            "python_date_format": "%Y-%m-%d",
            "expression": (
                "CASE WHEN length(month) = 7 THEN month || '-01' ELSE month END"
            ),
        },
    },
}


def apply_dttm_defaults(table: "SqlaTable", dttm_defaults: dict[str, Any]) -> None:
    """Applies dttm defaults to the table, mutates in place."""
    for dbcol in table.columns:
        # Set is_dttm is column is listed in dttm_columns.
        if dbcol.column_name in dttm_defaults.get("dttm_columns", {}):
            dbcol.is_dttm = True

        # Skip non dttm columns.
        if dbcol.column_name not in dttm_defaults.get("dttm_columns", {}):
            continue

        # Set table main_dttm_col.
        if dbcol.column_name == dttm_defaults.get("main_dttm_col"):
            table.main_dttm_col = dbcol.column_name

        # Apply defaults if empty.
        dttm_column_defaults = dttm_defaults.get("dttm_columns", {}).get(
            dbcol.column_name, {}
        )
        dbcol.is_dttm = True
        if (
            not dbcol.python_date_format
            and "python_date_format" in dttm_column_defaults
        ):
            dbcol.python_date_format = dttm_column_defaults["python_date_format"]
        if not dbcol.expression and "expression" in dttm_column_defaults:
            dbcol.expression = dttm_column_defaults["expression"]


@pytest.fixture
def test_table(session: Session) -> "SqlaTable":
    """
    Fixture that generates an in-memory table.
    """
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    columns = [
        TableColumn(column_name="ds", is_dttm=1, type="TIMESTAMP"),
        TableColumn(column_name="event_time", is_dttm=1, type="TIMESTAMP"),
        TableColumn(column_name="id", type="INTEGER"),
        TableColumn(column_name="dttm", type="INTEGER"),
        TableColumn(column_name="duration_ms", type="INTEGER"),
    ]

    return SqlaTable(
        table_name="test_table",
        columns=columns,
        metrics=[],
        main_dttm_col=None,
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
    )


def test_main_dttm_col(mocker: MockerFixture, test_table: "SqlaTable") -> None:
    """
    Test the ``SQLA_TABLE_MUTATOR`` config.
    """
    dttm_defaults = {
        "main_dttm_col": "event_time",
        "dttm_columns": {"ds": {}, "event_time": {}},
    }
    mocker.patch(
        "superset.connectors.sqla.models.config",
        new={
            "SQLA_TABLE_MUTATOR": partial(
                apply_dttm_defaults,
                dttm_defaults=dttm_defaults,
            )
        },
    )
    mocker.patch(
        "superset.connectors.sqla.models.get_physical_table_metadata",
        return_value=[
            {"column_name": "ds", "type": "TIMESTAMP", "is_dttm": True},
            {"column_name": "event_time", "type": "TIMESTAMP", "is_dttm": True},
            {"column_name": "id", "type": "INTEGER", "is_dttm": False},
        ],
    )

    assert test_table.main_dttm_col is None
    test_table.fetch_metadata()
    assert test_table.main_dttm_col == "event_time"


def test_main_dttm_col_nonexistent(
    mocker: MockerFixture,
    test_table: "SqlaTable",
) -> None:
    """
    Test the ``SQLA_TABLE_MUTATOR`` config when main datetime column doesn't exist.
    """
    dttm_defaults = {
        "main_dttm_col": "nonexistent",
    }
    mocker.patch(
        "superset.connectors.sqla.models.config",
        new={
            "SQLA_TABLE_MUTATOR": partial(
                apply_dttm_defaults,
                dttm_defaults=dttm_defaults,
            )
        },
    )
    mocker.patch(
        "superset.connectors.sqla.models.get_physical_table_metadata",
        return_value=[
            {"column_name": "ds", "type": "TIMESTAMP", "is_dttm": True},
            {"column_name": "event_time", "type": "TIMESTAMP", "is_dttm": True},
            {"column_name": "id", "type": "INTEGER", "is_dttm": False},
        ],
    )

    assert test_table.main_dttm_col is None
    test_table.fetch_metadata()
    # fall back to ds
    assert test_table.main_dttm_col == "ds"


def test_main_dttm_col_nondttm(
    mocker: MockerFixture,
    test_table: "SqlaTable",
) -> None:
    """
    Test the ``SQLA_TABLE_MUTATOR`` config when main datetime column has wrong type.
    """
    dttm_defaults = {
        "main_dttm_col": "id",
    }
    mocker.patch(
        "superset.connectors.sqla.models.config",
        new={
            "SQLA_TABLE_MUTATOR": partial(
                apply_dttm_defaults,
                dttm_defaults=dttm_defaults,
            )
        },
    )
    mocker.patch(
        "superset.connectors.sqla.models.get_physical_table_metadata",
        return_value=[
            {"column_name": "ds", "type": "TIMESTAMP", "is_dttm": True},
            {"column_name": "event_time", "type": "TIMESTAMP", "is_dttm": True},
            {"column_name": "id", "type": "INTEGER", "is_dttm": False},
        ],
    )

    assert test_table.main_dttm_col is None
    test_table.fetch_metadata()
    # fall back to ds
    assert test_table.main_dttm_col == "ds"


def test_python_date_format_by_column_name(
    mocker: MockerFixture,
    test_table: "SqlaTable",
) -> None:
    """
    Test the ``SQLA_TABLE_MUTATOR`` setting for "python_date_format".
    """
    table_defaults = {
        "dttm_columns": {
            "id": {"python_date_format": "epoch_ms"},
            "dttm": {"python_date_format": "epoch_s"},
        },
    }
    mocker.patch(
        "superset.connectors.sqla.models.config",
        new={
            "SQLA_TABLE_MUTATOR": partial(
                apply_dttm_defaults,
                dttm_defaults=table_defaults,
            )
        },
    )
    mocker.patch(
        "superset.connectors.sqla.models.get_physical_table_metadata",
        return_value=[
            {"column_name": "id", "type": "INTEGER", "is_dttm": False},
            {"column_name": "dttm", "type": "INTEGER", "is_dttm": False},
        ],
    )

    test_table.fetch_metadata()

    id_col = [c for c in test_table.columns if c.column_name == "id"][0]
    assert id_col.is_dttm
    assert id_col.python_date_format == "epoch_ms"

    dttm_col = [c for c in test_table.columns if c.column_name == "dttm"][0]
    assert dttm_col.is_dttm
    assert dttm_col.python_date_format == "epoch_s"


def test_expression_by_column_name(
    mocker: MockerFixture,
    test_table: "SqlaTable",
) -> None:
    """
    Test the ``SQLA_TABLE_MUTATOR`` setting for expression.
    """
    table_defaults = {
        "dttm_columns": {
            "dttm": {"expression": "CAST(dttm as INTEGER)"},
            "duration_ms": {"expression": "CAST(duration_ms as DOUBLE)"},
        },
    }
    mocker.patch(
        "superset.connectors.sqla.models.config",
        new={
            "SQLA_TABLE_MUTATOR": partial(
                apply_dttm_defaults,
                dttm_defaults=table_defaults,
            )
        },
    )
    mocker.patch(
        "superset.connectors.sqla.models.get_physical_table_metadata",
        return_value=[
            {"column_name": "dttm", "type": "INTEGER", "is_dttm": False},
            {"column_name": "duration_ms", "type": "INTEGER", "is_dttm": False},
        ],
    )

    test_table.fetch_metadata()

    dttm_col = [c for c in test_table.columns if c.column_name == "dttm"][0]
    assert dttm_col.is_dttm
    assert dttm_col.expression == "CAST(dttm as INTEGER)"

    duration_ms_col = [c for c in test_table.columns if c.column_name == "duration_ms"][
        0
    ]
    assert duration_ms_col.is_dttm
    assert duration_ms_col.expression == "CAST(duration_ms as DOUBLE)"


def test_full_setting(
    mocker: MockerFixture,
    test_table: "SqlaTable",
) -> None:
    """
    Test the ``SQLA_TABLE_MUTATOR`` with full settings.
    """
    mocker.patch(
        "superset.connectors.sqla.models.config",
        new={
            "SQLA_TABLE_MUTATOR": partial(
                apply_dttm_defaults,
                dttm_defaults=FULL_DTTM_DEFAULTS_EXAMPLE,
            )
        },
    )
    mocker.patch(
        "superset.connectors.sqla.models.get_physical_table_metadata",
        return_value=[
            {"column_name": "id", "type": "INTEGER", "is_dttm": False},
            {"column_name": "dttm", "type": "INTEGER", "is_dttm": False},
            {"column_name": "duration_ms", "type": "INTEGER", "is_dttm": False},
        ],
    )

    test_table.fetch_metadata()

    id_col = [c for c in test_table.columns if c.column_name == "id"][0]
    assert id_col.is_dttm
    assert id_col.python_date_format == "epoch_ms"
    assert id_col.expression == ""

    dttm_col = [c for c in test_table.columns if c.column_name == "dttm"][0]
    assert dttm_col.is_dttm
    assert dttm_col.python_date_format == "epoch_s"
    assert dttm_col.expression == "CAST(dttm as INTEGER)"
