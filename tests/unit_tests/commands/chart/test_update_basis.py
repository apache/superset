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
"""Real-session checks for the optional certified-update precondition."""

from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, Mock

import pytest
import sqlalchemy as sa
from flask import g
from pytest_mock import MockerFixture
from sqlalchemy.orm import Session

from superset.commands.chart.exceptions import ChartUpdateFailedError
from superset.commands.chart.update import ChartUpdateBasis, UpdateChartCommand
from superset.models.slice import Slice


def test_basis_fence_rechecks_exact_values_after_database_match(
    mocker: MockerFixture,
) -> None:
    """A case-insensitive database match cannot certify a case-only rename."""
    chart: Slice = Slice(slice_name="Original", viz_type="table")
    basis: ChartUpdateBasis = ChartUpdateBasis.from_chart(chart)
    chart.slice_name = "original"
    session: MagicMock = MagicMock()
    session.execute.return_value.rowcount = 1
    query: MagicMock = session.query.return_value
    query.options.return_value = query
    query.populate_existing.return_value = query
    query.filter.return_value = query
    query.with_for_update.return_value = query
    query.one_or_none.return_value = chart
    mocker.patch("superset.commands.chart.update.db", Mock(session=session))
    command: UpdateChartCommand = UpdateChartCommand(123, {}, expected_basis=basis)
    with pytest.raises(ChartUpdateFailedError, match="reload"):
        command._fence_expected_basis()


@pytest.mark.parametrize(
    "changed_field", ["params", "slice_name", "viz_type", "datasource_id", "deleted"]
)
def test_stale_certified_update_does_not_overwrite(
    app: Any, tmp_path: Path, mocker: MockerFixture, changed_field: str
) -> None:
    """Another writer's committed basis change must survive a stale update."""
    engine: sa.engine.Engine = sa.create_engine(f"sqlite:///{tmp_path / 'charts.db'}")
    Slice.metadata.create_all(engine)
    first: Session = Session(engine)
    second: Session = Session(engine)
    try:
        first.execute(
            Slice.__table__.insert().values(
                id=123,
                slice_name="Original",
                params='{"all_columns":["old"]}',
                datasource_id=1,
                datasource_type="semantic_view",
                viz_type="table",
            )
        )
        first.commit()
        chart: Slice = first.query(Slice).filter_by(id=123).one()
        basis: ChartUpdateBasis = ChartUpdateBasis.from_chart(chart)
        changed_value: Any = 2 if changed_field == "datasource_id" else "changed"
        if changed_field == "deleted":
            second.execute(sa.delete(Slice.__table__).where(Slice.id == 123))
        else:
            second.execute(
                sa.update(Slice.__table__)
                .where(Slice.id == 123)
                .values({changed_field: changed_value})
            )
        second.commit()
        # Preserve the stale identity-map instance, as a real in-flight request does.
        mocker.patch("superset.commands.chart.update.db", Mock(session=first))
        mocker.patch("superset.db", Mock(session=first))
        command: UpdateChartCommand = UpdateChartCommand(
            123,
            {"params": '{"all_columns":["new"]}', "slice_name": "Replacement"},
            expected_basis=basis,
        )
        mocker.patch.object(
            command, "validate", side_effect=lambda: setattr(command, "_model", chart)
        )
        with app.app_context():
            g.user = None
            with pytest.raises(ChartUpdateFailedError):
                command.run()
        second.expire_all()
        if changed_field == "deleted":
            assert second.query(Slice).filter_by(id=123).one_or_none() is None
        else:
            assert (
                getattr(second.query(Slice).filter_by(id=123).one(), changed_field)
                == changed_value
            )
    finally:
        first.close()
        second.close()
        engine.dispose()


def test_wal_stale_snapshot_refuses(
    app: Any, tmp_path: Path, mocker: MockerFixture
) -> None:
    """A real SQLite read snapshot cannot be promoted past a competing write."""
    engine: sa.engine.Engine = sa.create_engine(
        f"sqlite:///{tmp_path / 'snapshot.db'}", connect_args={"timeout": 0.05}
    )
    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA journal_mode=WAL")
    Slice.metadata.create_all(engine)
    with Session(engine) as first, Session(engine) as second:
        first.execute(
            Slice.__table__.insert().values(
                id=123,
                slice_name="Original",
                params=None,
                datasource_type="table",
                viz_type="table",
            )
        )
        first.commit()
        first.connection().exec_driver_sql("BEGIN")
        chart: Slice = first.get(Slice, 123)
        basis: ChartUpdateBasis = ChartUpdateBasis.from_chart(chart)
        second.execute(
            sa.update(Slice.__table__).where(Slice.id == 123).values(slice_name="Other")
        )
        second.commit()
        mocker.patch("superset.commands.chart.update.db", Mock(session=first))
        mocker.patch("superset.db", Mock(session=first))
        with app.app_context(), pytest.raises(ChartUpdateFailedError):
            UpdateChartCommand(123, {"slice_name": "Stale"}, expected_basis=basis).run()
        assert not first.in_transaction()
        assert first.get(Slice, 123).slice_name == "Other"
    engine.dispose()


@pytest.mark.parametrize("params", [None, '{"all_columns":["old"]}'])
def test_basis_fence_is_a_noop(
    app: Any, tmp_path: Path, mocker: MockerFixture, params: str | None
) -> None:
    """Acquiring the fence changes neither chart values nor version history."""
    engine: sa.engine.Engine = sa.create_engine(f"sqlite:///{tmp_path / 'noop.db'}")
    Slice.metadata.create_all(engine)
    session: Session = Session(engine)
    try:
        session.execute(
            Slice.__table__.insert().values(
                id=123,
                slice_name="Original",
                params=params,
                datasource_id=1,
                datasource_type="semantic_view",
                viz_type="table",
            )
        )
        session.commit()
        before: Any = session.execute(sa.select(Slice.__table__)).one()
        chart: Slice = session.query(Slice).filter_by(id=123).one()
        basis: ChartUpdateBasis = ChartUpdateBasis.from_chart(chart)
        mocker.patch("superset.commands.chart.update.db", Mock(session=session))
        command: UpdateChartCommand = UpdateChartCommand(123, {}, expected_basis=basis)
        versions: sa.Table = Slice.metadata.tables["slices_version"]
        before_versions: int = session.execute(
            sa.select(sa.func.count()).select_from(versions)
        ).scalar_one()
        with app.app_context():
            statements: list[str] = []

            def record_statement(
                connection: Any,
                cursor: Any,
                statement: str,
                parameters: Any,
                context: Any,
                executemany: bool,
            ) -> None:
                """Observe the fence's statements without setup or assertion queries."""
                statements.append(statement)

            sa.event.listen(engine, "before_cursor_execute", record_statement)
            command._fence_expected_basis()
            sa.event.remove(engine, "before_cursor_execute", record_statement)
            assert len(statements) == 2
            assert not any("DISTINCT" in statement.upper() for statement in statements)
            session.commit()
        after: Any = session.execute(sa.select(Slice.__table__)).one()
        assert tuple(after) == tuple(before)
        assert (
            session.execute(
                sa.select(sa.func.count()).select_from(versions)
            ).scalar_one()
            == before_versions
        )
    finally:
        session.close()
        engine.dispose()


@pytest.mark.parametrize("wal", [False, True])
def test_basis_fence_holds_until_transaction_end(
    app: Any, tmp_path: Path, mocker: MockerFixture, wal: bool
) -> None:
    """A second writer cannot alter a candidate's basis while it is fenced."""
    engine: sa.engine.Engine = sa.create_engine(
        f"sqlite:///{tmp_path / 'locked.db'}", connect_args={"timeout": 0.05}
    )
    if wal:
        with engine.connect() as connection:
            connection.exec_driver_sql("PRAGMA journal_mode=WAL")
    Slice.metadata.create_all(engine)
    first: Session = Session(engine)
    second: Session = Session(engine)
    try:
        first.execute(
            Slice.__table__.insert().values(
                id=123,
                slice_name="Original",
                params=None,
                datasource_id=1,
                datasource_type="semantic_view",
                viz_type="table",
            )
        )
        first.commit()
        chart: Slice = first.query(Slice).filter_by(id=123).one()
        mocker.patch("superset.commands.chart.update.db", Mock(session=first))
        command: UpdateChartCommand = UpdateChartCommand(
            123, {}, expected_basis=ChartUpdateBasis.from_chart(chart)
        )
        with app.app_context():
            command._fence_expected_basis()
        with pytest.raises(sa.exc.OperationalError, match="locked"):
            second.execute(
                sa.update(Slice.__table__)
                .where(Slice.id == 123)
                .values(slice_name="Other")
            )
        second.rollback()
        first.rollback()
        second.execute(
            sa.update(Slice.__table__).where(Slice.id == 123).values(slice_name="Other")
        )
        second.commit()
        assert second.query(Slice).filter_by(id=123).one().slice_name == "Other"
    finally:
        first.close()
        second.close()
        engine.dispose()
