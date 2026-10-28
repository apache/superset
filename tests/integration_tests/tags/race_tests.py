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
"""Exercise implicit-tag recovery with independent database transactions."""

from concurrent.futures import Future, ThreadPoolExecutor
from threading import Event
from uuid import uuid4

import pytest
from sqlalchemy import delete, event, select
from sqlalchemy.engine import Connection, Engine, ExecutionContext
from sqlalchemy.orm import Session

from superset import db
from superset.tags.models import get_tag, Tag, TagType


@pytest.mark.usefixtures("app_context")
def test_concurrent_tag_insert_preserves_losing_transaction() -> None:
    """Reuse a committed winner and commit subsequent work on the losing connection."""
    engine: Engine = db.engine
    if engine.dialect.name not in {"postgresql", "mysql"}:
        pytest.skip("requires PostgreSQL or MySQL concurrent unique-index checks")
    token: str = uuid4().hex
    tag_name: str = f"editor:race-{token}"
    follow_up_name: str = f"race-follow-up:{token}"
    inserting: Event = Event()

    def mark_insert(
        _connection: Connection,
        _cursor: object,
        _statement: str,
        _parameters: object,
        context: ExecutionContext,
        _executemany: bool,
    ) -> None:
        """Signal after the losing lookup, immediately before its real INSERT."""
        if context.isinsert:
            inserting.set()

    def lose_race() -> int:
        """Use a second outer transaction as an independent chart request would."""
        with engine.connect() as connection, connection.begin():
            assert connection.get_isolation_level() == "READ COMMITTED"
            event.listen(connection, "before_cursor_execute", mark_insert)
            try:
                with Session(bind=connection) as session:
                    tag: Tag = get_tag(tag_name, session, TagType.editor)
                    session.add(Tag(name=follow_up_name, type=TagType.custom))
                    session.flush()
                    return tag.id
            finally:
                event.remove(connection, "before_cursor_execute", mark_insert)

    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            with engine.connect() as connection, connection.begin() as transaction:
                assert connection.get_isolation_level() == "READ COMMITTED"
                with Session(bind=connection) as session:
                    winner: Tag = get_tag(tag_name, session, TagType.editor)
                    winner_id: int = winner.id
                    loser: Future[int] = executor.submit(lose_race)
                    assert inserting.wait(timeout=15), (
                        "loser never attempted its INSERT"
                    )
                    transaction.commit()
                    assert loser.result(timeout=15) == winner_id
        with Session(engine) as verification:
            assert verification.scalars(
                select(Tag.id).where(Tag.name == tag_name)
            ).all() == [winner_id]
            assert (
                verification.scalar(select(Tag.id).where(Tag.name == follow_up_name))
                is not None
            )
    finally:
        with engine.begin() as connection:
            connection.execute(
                delete(Tag).where(Tag.name.in_([tag_name, follow_up_name]))
            )
