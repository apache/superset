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
"""Tests for migration ``a7d3f1b9c2e4_cleanup_stale_can_import_pvm``'s transaction
handling: ``upgrade()``/``downgrade()`` must flush, not commit, so the migration's
session stays inside Alembic's own transaction instead of committing early.
"""

from importlib import import_module
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from superset.migrations.shared.security_converge import (
    _add_permission,
    _add_permission_view,
    _add_view_menu,
    _find_pvm,
    Base,
    Role,
)

migration = import_module(
    "superset.migrations.versions."
    "2026-06-23_03-23_a7d3f1b9c2e4_cleanup_stale_can_import_pvm"
)

VIEW = "ImportExportRestApi"
STALE_PERM = "can_import"  # no trailing underscore
LIVE_PERM = "can_import_"  # trailing underscore (the real permission)


@pytest.fixture
def engine():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return engine


def _seed_stale_pvm(session: Session) -> None:
    view_menu = _add_view_menu(session, VIEW)
    stale_permission = _add_permission(session, STALE_PERM)
    stale_pvm = _add_permission_view(session, stale_permission, view_menu)
    role = Role(name="stale_import_role")
    role.permissions.append(stale_pvm)
    session.add(role)
    session.commit()


def test_upgrade_flushes_without_committing(engine) -> None:
    """upgrade() must not call session.commit(). The migration session shares
    Alembic's connection, so an explicit commit there would end the outer
    transaction early and let the permission changes land even if a later step
    (including Alembic's own revision stamp write) fails."""
    with Session(engine) as seed:
        _seed_stale_pvm(seed)

    with engine.begin() as conn:
        with (
            patch.object(migration, "op") as mock_op,
            patch.object(Session, "commit") as mock_commit,
        ):
            mock_op.get_bind.return_value = conn
            migration.upgrade()
        mock_commit.assert_not_called()

    # The outer `engine.begin()` block committed on exit, exactly like Alembic's
    # own transaction would, so the changes must be visible now that flush (not
    # an inner commit) is what makes them visible on the shared connection.
    with Session(engine) as verify:
        assert _find_pvm(verify, VIEW, LIVE_PERM) is not None
        assert _find_pvm(verify, VIEW, STALE_PERM) is None


def test_upgrade_changes_are_rolled_back_if_outer_transaction_fails(engine) -> None:
    """If the outer (Alembic-managed) transaction never commits, none of the
    migration's changes should be persisted -- proving upgrade() no longer owns
    its own commit."""
    with Session(engine) as seed:
        _seed_stale_pvm(seed)

    conn = engine.connect()
    trans = conn.begin()
    try:
        with (
            patch.object(migration, "op") as mock_op,
            patch.object(Session, "commit") as mock_commit,
        ):
            mock_op.get_bind.return_value = conn
            migration.upgrade()
        mock_commit.assert_not_called()
    finally:
        trans.rollback()
        conn.close()

    with Session(engine) as verify:
        assert _find_pvm(verify, VIEW, STALE_PERM) is not None
        assert _find_pvm(verify, VIEW, LIVE_PERM) is None


def test_downgrade_flushes_without_committing(engine) -> None:
    """downgrade() is a no-op by design, but must still avoid committing so it
    stays inside Alembic's transaction the same way upgrade() does."""
    with engine.begin() as conn:
        with (
            patch.object(migration, "op") as mock_op,
            patch.object(Session, "commit") as mock_commit,
        ):
            mock_op.get_bind.return_value = conn
            migration.downgrade()
        mock_commit.assert_not_called()
