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
"""Real governed rows in a real session, with the deny-by-default guard live.

Not a test module. The guard is a SQLAlchemy listener, so the only honest way
to test it is to flush real ``Dashboard``/``Slice``/``SqlaTable`` rows through
a real session and see what comes back; mocking the session would test the
mock. Everything that reaches outside the session -- who is acting, whether a
dashboard was ever published, whether a request is waiting -- is a stand-in the
test controls through ``world.state``.
"""

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import gate
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

AUTHOR = 5


@pytest.fixture
def guarded_world(session: Session, mocker: MockerFixture) -> SimpleNamespace:
    """A live dashboard, a draft, a chart and a dataset, all committed.

    Seeded with review off so the seed is not itself judged, and committed so
    every row is an ordinary persistent one and not "born in this transaction".
    """
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.models.core import Database, FavStar  # noqa: F401
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    Dashboard.metadata.create_all(session.get_bind())  # pylint: disable=no-member

    live = Dashboard(id=1, dashboard_title="live", published=True)
    draft = Dashboard(id=2, dashboard_title="draft", published=False)
    chart = Slice(
        id=1,
        slice_name="chart",
        viz_type="table",
        datasource_id=1,
        datasource_type="table",
        params="{}",
    )
    database = Database(database_name="d", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(
        table_name="t",
        database=database,
        columns=[TableColumn(column_name="a")],
        metrics=[SqlMetric(metric_name="m", expression="1")],
    )
    session.add_all([live, draft, chart, database, dataset])
    session.commit()

    state = SimpleNamespace(
        ever_published=set(),
        in_review=set(),
        author=AUTHOR,
        enabled=True,
        allowed=False,
    )
    mocker.patch.object(gate, "is_enabled", side_effect=lambda: state.enabled)
    mocker.patch.object(gate, "is_replaying", return_value=False)
    mocker.patch.object(gate, "get_user_id", side_effect=lambda: state.author)
    mocker.patch.object(
        gate, "unlisted_writes_allowed", side_effect=lambda: state.allowed
    )
    mocker.patch.object(
        gate,
        "has_ever_been_published",
        side_effect=lambda _type, asset_id: asset_id in state.ever_published,
    )
    mocker.patch.object(
        gate,
        "_pending_review_exists",
        side_effect=lambda _type, asset_id: asset_id in state.in_review,
    )
    filed = mocker.patch.object(gate, "file_first_publish_request")
    return SimpleNamespace(
        session=session,
        live=live,
        draft=draft,
        chart=chart,
        dataset=dataset,
        state=state,
        filed=filed,
    )


def commit_or_raise(session: Session) -> Any:
    """Commit, returning the refusal if there is one and rolling back if so."""
    from asset_approval.exceptions import UnreviewableWriteRefusedError

    try:
        session.commit()
    except UnreviewableWriteRefusedError as refusal:
        session.rollback()
        return refusal
    return None


@pytest.fixture
def request_store(mocker: MockerFixture, tmp_path: Any) -> SimpleNamespace:
    """A real \`\`change_requests\`\` table, written on connections of its own.

    On disk, as the publish-mark tests do, because the point is that the gate
    writes on a different connection from the caller's. \`\`ab_user\`\` is a
    stub: the table only needs something for its foreign keys to name.
    """
    from asset_approval.models import ChangeRequest
    from sqlalchemy import Column, create_engine, Integer, MetaData, Table

    metadata = MetaData()
    Table("ab_user", metadata, Column("id", Integer, primary_key=True))
    table = ChangeRequest.__table__.to_metadata(metadata)
    engine = create_engine(f"sqlite:///{tmp_path}/requests.db")
    metadata.create_all(engine)
    mocker.patch.object(gate, "db", SimpleNamespace(engine=engine, session=None))

    def row(request_id: int) -> Any:
        with engine.connect() as connection:
            return connection.execute(
                table.select().where(table.c.id == request_id)
            ).one()

    def decide(request_id: int, status: str, reviewer: int = 2) -> None:
        """What \`\`lifecycle.approve\`\` commits, from another connection."""
        from datetime import datetime

        with engine.begin() as connection:
            connection.execute(
                table.update()
                .where(table.c.id == request_id)
                .values(
                    status=status,
                    active_slot=None,
                    reviewer_fk=reviewer,
                    decided_at=datetime(2026, 11, 4, 12, 0),
                )
            )

    return SimpleNamespace(engine=engine, table=table, row=row, decide=decide)
