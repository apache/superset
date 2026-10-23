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
"""Exercise ``get_tag`` races with real inserts against disposable tables."""

from collections.abc import Iterator

import pytest
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from superset.tags.models import get_tag, Tag, TaggedObject, TagType


@pytest.fixture
def tag_session(session_engine: Engine) -> Iterator[Session]:
    """Create disposable real tables without touching the application database."""
    Tag.metadata.create_all(session_engine)
    try:
        with Session(session_engine) as session:
            yield session
    finally:
        session_engine.dispose()


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


def test_failed_pending_work_is_not_treated_as_a_tag_race(
    tag_session: Session,
) -> None:
    """A failure flushing pre-savepoint work must remain an outer failure."""
    tag_session.add(Tag(name="pending", type=TagType.custom))
    tag_session.commit()
    tag_session.add(Tag(name="pending", type=TagType.custom))
    with tag_session.no_autoflush:
        with pytest.raises(IntegrityError, match="tag.name"):
            get_tag("editor:1", tag_session, TagType.editor)
    assert not tag_session.is_active
    tag_session.rollback()
    assert tag_session.query(Tag).count() == 1
