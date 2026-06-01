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
"""Unit tests for ``find_existing_for_import`` /
``clear_soft_deleted_for_import``.

These pin the side-effect-free / side-effect split that addresses
Richard's review on PR #39977: ``find`` returns soft-deleted matches
as-is so the importer can decide overwrite/permission before
``clear_soft_deleted_for_import`` performs the destructive op.
"""

from __future__ import annotations

from collections.abc import Generator

import pytest
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm.session import Session
from sqlalchemy_utils import UUIDType

from superset.commands.importers.v1.utils import (
    clear_soft_deleted_for_import,
    find_existing_for_import,
)
from superset.models.helpers import SoftDeleteMixin

_TestBase = declarative_base()


class _ImportableSoftDeletable(SoftDeleteMixin, _TestBase):  # type: ignore[misc, valid-type]
    __tablename__ = "_importable_soft_deletable_test"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    uuid = Column(UUIDType(binary=False), unique=True)


@pytest.fixture
def _synthetic_table(session: Session) -> Generator[None, None, None]:
    _ImportableSoftDeletable.metadata.create_all(session.get_bind())
    yield
    _ImportableSoftDeletable.metadata.drop_all(session.get_bind())


@pytest.mark.usefixtures("_synthetic_table")
def test_find_returns_none_when_no_match(app_context: None, session: Session) -> None:
    """No row with this UUID — function returns ``None``."""
    result = find_existing_for_import(
        _ImportableSoftDeletable,
        "00000000-0000-0000-0000-000000000000",
    )
    assert result is None


@pytest.mark.usefixtures("_synthetic_table")
def test_find_returns_live_row_as_is(
    app_context: None, session: Session, mocker: object
) -> None:
    """A live (not soft-deleted) row is returned as the existing row
    so the caller can treat it as an overwrite target."""
    import uuid as uuid_lib

    obj_uuid = uuid_lib.uuid4()
    obj = _ImportableSoftDeletable(name="live", uuid=obj_uuid)
    session.add(obj)
    session.flush()

    result = find_existing_for_import(_ImportableSoftDeletable, str(obj_uuid))
    assert result is not None
    assert result.deleted_at is None
    assert result.name == "live"


@pytest.mark.usefixtures("_synthetic_table")
def test_find_returns_soft_deleted_row_as_is(
    app_context: None, session: Session
) -> None:
    """A soft-deleted row is returned *with its ``deleted_at`` set*.
    Caller is responsible for deciding what to do with it — typically
    calling ``clear_soft_deleted_for_import`` after a permission
    check. The function does NOT hard-delete as a side effect.
    """
    import uuid as uuid_lib

    obj_uuid = uuid_lib.uuid4()
    obj = _ImportableSoftDeletable(name="deleted_target", uuid=obj_uuid)
    session.add(obj)
    session.flush()
    obj.soft_delete()
    session.flush()

    result = find_existing_for_import(_ImportableSoftDeletable, str(obj_uuid))
    assert result is not None
    assert result.deleted_at is not None
    assert result.name == "deleted_target"


@pytest.mark.usefixtures("_synthetic_table")
def test_clear_hard_deletes_the_row(app_context: None, session: Session) -> None:
    """``clear_soft_deleted_for_import`` calls
    ``db.session.delete(existing)`` so the row is permanently removed
    (not just re-soft-deleted) and ORM ``after_delete`` listeners fire.
    A subsequent insert with the same UUID would not collide.
    """
    import uuid as uuid_lib

    obj_uuid = uuid_lib.uuid4()
    obj = _ImportableSoftDeletable(name="to_clear", uuid=obj_uuid)
    session.add(obj)
    session.flush()
    obj.soft_delete()
    session.flush()
    obj_id = obj.id

    clear_soft_deleted_for_import(obj)

    # Row is gone — bypass-aware lookup returns None.
    found = find_existing_for_import(_ImportableSoftDeletable, str(obj_uuid))
    assert found is None
    # And session.query confirms it's hard-deleted, not just soft.
    from superset.models.helpers import SKIP_VISIBILITY_FILTER_CLASSES

    raw = (
        session.query(_ImportableSoftDeletable)
        .execution_options(
            **{SKIP_VISIBILITY_FILTER_CLASSES: {_ImportableSoftDeletable}}
        )
        .filter_by(id=obj_id)
        .one_or_none()
    )
    assert raw is None


@pytest.mark.usefixtures("_synthetic_table")
def test_find_then_clear_is_the_intended_caller_sequence(
    app_context: None, session: Session
) -> None:
    """The two functions compose as the documented contract: find
    first, decide based on the returned row, then clear if needed.
    Pinning this sequence ensures a refactor doesn't reverse the
    intent (find side-effects, clear pure)."""
    import uuid as uuid_lib

    obj_uuid = uuid_lib.uuid4()
    obj = _ImportableSoftDeletable(name="reimport_target", uuid=obj_uuid)
    session.add(obj)
    session.flush()
    obj.soft_delete()
    session.flush()

    # Step 1: find (pure). Caller now has the row to make decisions on.
    existing = find_existing_for_import(_ImportableSoftDeletable, str(obj_uuid))
    assert existing is not None
    assert existing.deleted_at is not None

    # Step 2: caller decides to clear (in real code, after overwrite +
    # permission checks pass).
    clear_soft_deleted_for_import(existing)

    # Step 3: caller can now re-insert with the same UUID without
    # colliding.
    fresh = _ImportableSoftDeletable(name="fresh", uuid=obj_uuid)
    session.add(fresh)
    session.flush()
    assert fresh.id is not None
    assert fresh.deleted_at is None
