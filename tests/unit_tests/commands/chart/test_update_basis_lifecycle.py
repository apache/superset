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
"""Run the normal command and capture listeners on disposable metadata databases."""

import os
from collections.abc import Iterator
from typing import Any
from unittest.mock import Mock

import pytest
import sqlalchemy as sa
from flask import g
from flask_appbuilder import Model
from pytest_mock import MockerFixture
from sqlalchemy.orm import Session

from superset.app import SupersetApp
from superset.commands.chart.exceptions import (
    ChartForbiddenError,
    ChartUpdateFailedError,
)
from superset.commands.chart.update import ChartUpdateBasis, UpdateChartCommand
from superset.exceptions import SupersetSecurityException
from superset.extensions import db
from superset.models.slice import Slice


def _disposable_uri() -> str:
    """Refuse non-local/non-dedicated databases before app initialization."""
    uri: str = os.environ.get("SC130336_TEST_URI", "sqlite://")
    url: sa.engine.URL = sa.engine.make_url(uri)
    if uri != "sqlite://" and not (
        url.host == "127.0.0.1"
        and url.database == "sc130336"
        and (url.get_backend_name(), url.port)
        in {("postgresql", 55436), ("mysql", 53336)}
    ):
        raise ValueError("Only disposable sc130336 databases are allowed")
    return uri


pytestmark: pytest.MarkDecorator = pytest.mark.parametrize(
    "app",
    [
        {
            "SQLALCHEMY_DATABASE_URI": _disposable_uri(),
            "FAB_CREATE_DB": False,
            "FAB_UPDATE_PERMS": False,
        }
    ],
    indirect=True,
)


@pytest.fixture
def capture_session(app: SupersetApp, mocker: MockerFixture) -> Iterator[Session]:
    """Retain production session, validation, mutation and capture wiring."""
    # This unrelated model has unbounded TEXT unique keys unsupported by MySQL.
    # It is not referenced by charts or version capture; leave it outside the fixture.
    tables: list[sa.Table] = [
        table
        for table in Model.metadata.sorted_tables
        if table.name != "dynamic_plugin"
    ]
    Model.metadata.create_all(db.engine, tables=tables)
    mocker.patch(
        "superset.commands.chart.update.security_manager.is_admin", return_value=True
    )
    mocker.patch(
        "superset.commands.chart.update.security_manager.can_access_all_datasources",
        return_value=True,
    )
    mocker.patch("superset.commands.chart.update.security_manager.raise_for_editorship")
    g.user = None
    try:
        yield db.session()
    finally:
        db.session.remove()
        Model.metadata.drop_all(db.engine, tables=tables)


def _history(session: Session) -> dict[str, int]:
    """Count all audit tables so an extra guard record cannot hide."""
    return {
        table.name: session.execute(
            sa.select(sa.func.count()).select_from(table)
        ).scalar_one()
        for table in Model.metadata.tables.values()
        if table.name.endswith("_version")
        or table.name in {"version_transaction", "version_changes"}
    }


def test_fenced_command_has_ordinary_save_audit(capture_session: Session) -> None:
    """A fenced save produces the same audit delta as an ordinary save."""
    ordinary: Slice = Slice(
        slice_name="Original", viz_type="table", params="{}", datasource_type="table"
    )
    fenced: Slice = Slice(
        slice_name="Original", viz_type="table", params="{}", datasource_type="table"
    )
    capture_session.add_all([ordinary, fenced])
    capture_session.commit()
    before: dict[str, int] = _history(capture_session)
    UpdateChartCommand(ordinary.id, {"slice_name": "Replacement"}).run()
    middle: dict[str, int] = _history(capture_session)
    UpdateChartCommand(
        fenced.id,
        {"slice_name": "Replacement"},
        expected_basis=ChartUpdateBasis.from_chart(fenced),
    ).run()
    after: dict[str, int] = _history(capture_session)
    assert {key: middle[key] - value for key, value in before.items()} == {
        key: after[key] - value for key, value in middle.items()
    }
    assert after["slices_version"] - middle["slices_version"] == 1
    assert after["version_transaction"] - middle["version_transaction"] == 1
    assert after["version_changes"] > middle["version_changes"]
    capture_session.expire_all()
    assert capture_session.get(Slice, fenced.id).slice_name == "Replacement"


def test_fenced_command_denial_rolls_back(
    capture_session: Session, mocker: MockerFixture
) -> None:
    """Permission denial after fencing leaves both live data and history intact."""
    chart: Slice = Slice(
        slice_name="Original", viz_type="table", params="{}", datasource_type="table"
    )
    capture_session.add(chart)
    capture_session.commit()
    before: dict[str, int] = _history(capture_session)
    mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_editorship",
        side_effect=SupersetSecurityException(Mock()),
    )
    with pytest.raises(ChartForbiddenError):
        UpdateChartCommand(
            chart.id,
            {"slice_name": "Denied"},
            expected_basis=ChartUpdateBasis.from_chart(chart),
        ).run()
    assert _history(capture_session) == before
    capture_session.expire_all()
    assert chart.slice_name == "Original"
    # A separate writer succeeding also proves the denied command released its fence.
    with Session(db.engine) as other:
        other.execute(
            sa.update(Slice.__table__)
            .where(Slice.id == chart.id)
            .values(slice_name="Other")
        )
        other.commit()


@pytest.mark.parametrize(
    "field",
    ["params", "datasource_id", "slice_name", "viz_type", "deleted", "case_only_name"],
)
def test_fenced_command_rejects_committed_competitor(
    capture_session: Session, field: str
) -> None:
    """A stale identity map and snapshot cannot overwrite a competing commit."""
    chart: Slice = Slice(
        slice_name="Original", viz_type="table", params=None, datasource_type="table"
    )
    capture_session.add(chart)
    capture_session.commit()
    basis: ChartUpdateBasis = ChartUpdateBasis.from_chart(chart)
    chart_id: int = chart.id
    value: Any = 99 if field == "datasource_id" else "Other"
    if field == "case_only_name":
        field = "slice_name"
        value = "original"
    with Session(db.engine) as other:
        if field == "deleted":
            other.execute(sa.delete(Slice.__table__).where(Slice.id == chart_id))
        else:
            other.execute(
                sa.update(Slice.__table__)
                .where(Slice.id == chart_id)
                .values({field: value})
            )
        other.commit()
    with pytest.raises(ChartUpdateFailedError):
        UpdateChartCommand(
            chart_id, {"slice_name": "Stale"}, expected_basis=basis
        ).run()
    with Session(db.engine) as reader:
        row: Slice | None = reader.get(Slice, chart_id)
        if field == "deleted":
            assert row is None
        else:
            assert row is not None
            assert getattr(row, field) == value


def test_unchanged_null_basis_matches(capture_session: Session) -> None:
    """A no-op UPDATE must report a matched row even when it changes no values."""
    chart: Slice = Slice(
        slice_name="Original", viz_type="table", params=None, datasource_type="table"
    )
    capture_session.add(chart)
    capture_session.commit()
    before: dict[str, int] = _history(capture_session)
    before_row: Any = capture_session.execute(sa.select(Slice.__table__)).one()
    UpdateChartCommand(
        chart.id, {}, expected_basis=ChartUpdateBasis.from_chart(chart)
    )._fence_expected_basis()
    capture_session.commit()
    assert _history(capture_session) == before
    assert tuple(capture_session.execute(sa.select(Slice.__table__)).one()) == tuple(
        before_row
    )


@pytest.mark.skipif(
    _disposable_uri() == "sqlite://",
    reason="SQLite contention uses file-backed test_update_basis fixtures",
)
def test_database_fence_blocks_second_writer(capture_session: Session) -> None:
    """The fence lasts through the command transaction, not just its SELECT."""
    chart: Slice = Slice(
        slice_name="Original", viz_type="table", params=None, datasource_type="table"
    )
    capture_session.add(chart)
    capture_session.commit()
    chart_id: int = chart.id
    UpdateChartCommand(
        chart_id, {}, expected_basis=ChartUpdateBasis.from_chart(chart)
    )._fence_expected_basis()
    with Session(db.engine) as other:
        if db.engine.dialect.name == "postgresql":
            other.execute(sa.text("SET LOCAL lock_timeout = '100ms'"))
        else:
            other.execute(sa.text("SET SESSION innodb_lock_wait_timeout = 1"))
        with pytest.raises(sa.exc.OperationalError, match="[Ll]ock"):
            other.execute(
                sa.update(Slice.__table__)
                .where(Slice.id == chart_id)
                .values(slice_name="Other")
            )
        other.rollback()
        capture_session.rollback()
        other.execute(
            sa.update(Slice.__table__)
            .where(Slice.id == chart_id)
            .values(slice_name="Other")
        )
        other.commit()
        assert other.get(Slice, chart_id).slice_name == "Other"
