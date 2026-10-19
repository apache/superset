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
"""Exercise tag races with real inserts and deterministic stale lookups."""

from collections.abc import Callable, Iterator
from unittest.mock import patch

import pytest
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Query, Session

from superset.models.core import FavStar
from superset.models.slice import Slice
from superset.tags.models import (
    ChartUpdater,
    FavStarUpdater,
    get_tag,
    ObjectType,
    Tag,
    TaggedObject,
    TagType,
)


@pytest.fixture
def tag_session(session_engine: Engine) -> Iterator[Session]:
    """Create disposable real tables without touching the application database."""
    Tag.metadata.create_all(session_engine)
    registered: bool = event.contains(Slice, "after_insert", ChartUpdater.after_insert)
    if not registered:
        event.listen(Slice, "after_insert", ChartUpdater.after_insert)
    try:
        with Session(session_engine) as session:
            yield session
    finally:
        if not registered:
            event.remove(Slice, "after_insert", ChartUpdater.after_insert)
        session_engine.dispose()


@pytest.mark.parametrize(
    "name,type_", [("editor:1", TagType.editor), ("type:chart", TagType.type)]
)
@pytest.mark.parametrize("commit", [False, True])
def test_chart_insert_survives_tag_race(
    tag_session: Session, name: str, type_: TagType, commit: bool
) -> None:
    """A stale tag lookup must not fail chart creation or own its transaction."""
    tag_session.add(Tag(name=name, type=type_))
    tag_session.commit()
    original_lookup: Callable[[Query], Tag | None] = Query.one_or_none
    missed: bool = False

    def stale_lookup(query: Query) -> Tag | None:
        """Hide the winner once, simulating its commit after the first SELECT."""
        nonlocal missed
        result: Tag | None = original_lookup(query)
        if not missed and isinstance(result, Tag) and result.name == name:
            missed = True
            return None
        return result

    chart: Slice = Slice(slice_name="concurrent chart", viz_type="table")
    with (
        patch("superset.tags.models.tagging_enabled", return_value=True),
        patch.object(ChartUpdater, "get_editor_user_ids", return_value=[1]),
        patch.object(Query, "one_or_none", stale_lookup),
    ):
        tag_session.add(chart)
        tag_session.flush()

    assert missed
    assert tag_session.query(Slice).count() == 1
    assert tag_session.query(TaggedObject).count() == 2
    assert {tag.name for tag in tag_session.query(Tag)} == {"editor:1", "type:chart"}
    if commit:
        tag_session.commit()
    else:
        tag_session.rollback()
    assert tag_session.query(Slice).count() == int(commit)
    assert tag_session.query(TaggedObject).count() == 2 * int(commit)
    assert tag_session.query(Tag).count() == 1 + int(commit)


@pytest.mark.parametrize("pending_work", [False, True])
def test_tag_creation_does_not_commit_callers_work(
    tag_session: Session, pending_work: bool
) -> None:
    """Creating a tag must remain part of the caller's transaction."""
    pending: Tag = Tag(name="pending", type=TagType.custom)
    if pending_work:
        tag_session.add(pending)
    created: Tag = get_tag("editor:1", tag_session, TagType.editor)
    assert created.id is not None
    tag_session.rollback()
    assert tag_session.query(Tag).count() == 0


def test_tag_race_does_not_hide_different_type(
    tag_session: Session, caplog: pytest.LogCaptureFixture
) -> None:
    """A same-name tag of another type is not a successful concurrent insert."""
    tag_session.add(Tag(name="editor:1", type=TagType.custom))
    tag_session.commit()
    pending: Tag = Tag(name="pending", type=TagType.custom)
    tag_session.add(pending)
    with pytest.raises(IntegrityError):
        get_tag("editor:1", tag_session, TagType.editor)
    assert "Tag name 'editor:1' is already used by a different tag type" in caplog.text
    assert tag_session.query(TaggedObject).count() == 0
    assert tag_session.is_active
    assert tag_session.query(Tag).filter_by(name="pending").one() is pending
    tag_session.rollback()
    assert tag_session.query(Tag).count() == 1


def test_duplicate_link_race_preserves_outer_work(tag_session: Session) -> None:
    """Reuse an implicit tag link if another transaction wins its insert."""
    winner: Tag = Tag(name="editor:1", type=TagType.editor)
    tag_session.add(winner)
    tag_session.flush()
    tag_id: int = winner.id
    tag_session.add(
        TaggedObject(tag_id=tag_id, object_id=1, object_type=ObjectType.chart)
    )
    tag_session.commit()
    pending: Tag = Tag(name="pending", type=TagType.custom)
    tag_session.add(pending)
    tag_session.flush()
    with patch.object(Query, "scalar", return_value=False):
        ChartUpdater.add_tag_object_if_not_tagged(tag_session, tag_id, 1, "chart")
        tag_session.flush()
    assert tag_session.query(TaggedObject).count() == 1
    assert tag_session.query(Tag).filter_by(name="pending").one() is pending
    tag_session.rollback()
    assert tag_session.query(Tag).count() == 1


@pytest.mark.parametrize("favorite", [False, True])
def test_implicit_link_writers_reuse_concurrent_link(
    tag_session: Session, favorite: bool
) -> None:
    """Editor updates and favorites must use the same race-safe link insertion."""
    winner: Tag = Tag(
        name="favorited_by:1" if favorite else "editor:1",
        type=TagType.favorited_by if favorite else TagType.editor,
    )
    tag_session.add(winner)
    tag_session.flush()
    tag_session.add(
        TaggedObject(tag_id=winner.id, object_id=1, object_type=ObjectType.chart)
    )
    tag_session.commit()
    pending: Tag = Tag(name="pending", type=TagType.custom)
    tag_session.add(pending)
    tag_session.flush()
    with (
        patch("superset.tags.models.tagging_enabled", return_value=True),
        patch.object(ChartUpdater, "get_editor_user_ids", return_value=[1]),
        patch.object(Query, "all", return_value=[]),
        patch.object(Query, "scalar", return_value=False),
    ):
        if favorite:
            FavStarUpdater.after_insert(
                FavStar.__mapper__,
                tag_session.connection(),
                FavStar(user_id=1, obj_id=1, class_name="slice"),
            )
        else:
            ChartUpdater.after_update(
                Slice.__mapper__, tag_session.connection(), Slice(id=1)
            )
    assert tag_session.query(TaggedObject).count() == 1
    assert tag_session.query(Tag).filter_by(name="pending").one() is pending
    tag_session.rollback()
    assert tag_session.query(Tag).count() == 1


def test_link_insert_does_not_hide_foreign_key_error(tag_session: Session) -> None:
    """Only an existing matching link may recover an insert failure."""
    tag_session.connection().exec_driver_sql("PRAGMA foreign_keys=ON")
    pending: Tag = Tag(name="pending", type=TagType.custom)
    tag_session.add(pending)
    with pytest.raises(IntegrityError, match="FOREIGN KEY"):
        ChartUpdater.add_tag_object_if_not_tagged(tag_session, 999, 1, "chart")
    assert tag_session.is_active
    assert tag_session.query(Tag).filter_by(name="pending").one() is pending
    tag_session.rollback()
    assert tag_session.query(Tag).count() == 0


@pytest.mark.parametrize("link", [False, True])
def test_failed_pending_work_is_not_treated_as_a_tag_race(
    tag_session: Session, link: bool
) -> None:
    """A failure flushing pre-savepoint work must remain an outer failure."""
    tag_session.add(Tag(name="pending", type=TagType.custom))
    tag_session.commit()
    tag_session.add(Tag(name="pending", type=TagType.custom))
    with tag_session.no_autoflush:
        if link:
            with pytest.raises(IntegrityError, match="tag.name"):
                ChartUpdater.add_tag_object_if_not_tagged(tag_session, 1, 1, "chart")
        else:
            with pytest.raises(IntegrityError, match="tag.name"):
                get_tag("editor:1", tag_session, TagType.editor)
    assert not tag_session.is_active
    tag_session.rollback()
    assert tag_session.query(Tag).count() == 1
