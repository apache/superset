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
"""Migration-level tests for ``a1b2c3d4e5f6`` (granular export permissions).

The migration replaces ``can_csv`` on every role with ``can_export_data``,
``can_export_image`` and ``can_copy_clipboard``. ``superset init`` recreates
``can_csv`` afterwards (``create_custom_permissions``), so a database that runs
this revision a second time -- e.g. after its ``alembic_version`` is stamped
back to the parent revision -- must not redo the conversion on roles whose
granular export permissions were already set.
"""

from __future__ import annotations

import logging
from importlib import import_module

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm import Session

from superset.migrations.shared.security_converge import (
    Base,
    Permission,
    PermissionView,
    Role,
    ViewMenu,
)

migration = import_module(
    "superset.migrations.versions."
    "2026-03-02_12-00_a1b2c3d4e5f6_add_granular_export_permissions"
)

GRANULAR = {"can_export_data", "can_export_image", "can_copy_clipboard"}


@pytest.fixture(autouse=True)
def setup_tables(session: Session) -> None:
    engine = session.get_bind()
    Base.metadata.create_all(engine)


def _make_pvm(session: Session, permission_name: str) -> PermissionView:
    view = session.query(ViewMenu).filter_by(name="Superset").one_or_none()
    if view is None:
        view = ViewMenu(name="Superset")
        session.add(view)
    permission = session.query(Permission).filter_by(name=permission_name).one_or_none()
    if permission is None:
        permission = Permission(name=permission_name)
        session.add(permission)
    session.flush()
    pvm = PermissionView(view_menu=view, permission=permission)
    session.add(pvm)
    session.flush()
    return pvm


def _perm_names(session: Session, role_name: str) -> set[str]:
    role = session.query(Role).filter_by(name=role_name).one()
    return {pvm.permission.name for pvm in role.permissions}


def _can_csv_exists(session: Session) -> bool:
    return (
        session.query(PermissionView)
        .join(Permission)
        .filter(Permission.name == "can_csv")
        .count()
        > 0
    )


def test_first_run_converts_can_csv_to_granular_permissions(
    session: Session,
) -> None:
    can_csv = _make_pvm(session, "can_csv")
    session.add(Role(name="Analyst", permissions=[can_csv]))
    session.add(Role(name="NoExport", permissions=[]))
    session.commit()

    migration.do_upgrade(session)
    session.commit()

    assert _perm_names(session, "Analyst") == GRANULAR
    assert _perm_names(session, "NoExport") == set()
    assert not _can_csv_exists(session)


def test_rerun_keeps_granular_choices_made_after_the_first_run(
    session: Session,
) -> None:
    """State after a first run plus ``superset init``: ``can_csv`` exists
    again and a role holds it next to a deliberately narrowed set of granular
    permissions (image export only). Re-running the revision must leave that
    role exactly as it is instead of granting data export and clipboard."""
    can_csv = _make_pvm(session, "can_csv")
    export_image = _make_pvm(session, "can_export_image")
    _make_pvm(session, "can_export_data")
    _make_pvm(session, "can_copy_clipboard")
    session.add(Role(name="ImageOnly", permissions=[can_csv, export_image]))
    session.commit()

    migration.do_upgrade(session)
    session.commit()

    assert _perm_names(session, "ImageOnly") == {"can_csv", "can_export_image"}
    assert _can_csv_exists(session)


def test_rerun_still_converts_legacy_only_roles(session: Session) -> None:
    """A role holding only ``can_csv`` is converted on any run, while a role
    that already has granular permissions keeps ``can_csv``, so the PVM is
    not deleted from under it."""
    can_csv = _make_pvm(session, "can_csv")
    export_data = _make_pvm(session, "can_export_data")
    _make_pvm(session, "can_export_image")
    _make_pvm(session, "can_copy_clipboard")
    session.add(Role(name="Legacy", permissions=[can_csv]))
    session.add(Role(name="Curated", permissions=[can_csv, export_data]))
    session.commit()

    migration.do_upgrade(session)
    session.commit()

    assert _perm_names(session, "Legacy") == GRANULAR
    assert _perm_names(session, "Curated") == {"can_csv", "can_export_data"}
    assert _can_csv_exists(session)


def test_logs_each_role_change(
    session: Session, caplog: pytest.LogCaptureFixture
) -> None:
    """Each role gets a log line: the converted one and the one that keeps
    ``can_csv`` because its granular permissions are already set."""
    can_csv = _make_pvm(session, "can_csv")
    export_data = _make_pvm(session, "can_export_data")
    _make_pvm(session, "can_export_image")
    _make_pvm(session, "can_copy_clipboard")
    session.add(Role(name="Legacy", permissions=[can_csv]))
    session.add(Role(name="Curated", permissions=[can_csv, export_data]))
    session.add(Role(name="NoExport", permissions=[]))
    session.commit()

    with caplog.at_level(logging.INFO, logger="alembic.env"):
        migration.do_upgrade(session)

    messages = [
        record.getMessage() for record in caplog.records if record.name == "alembic.env"
    ]
    assert "Keeping can_csv Superset on Curated: granular perms already set" in messages
    assert any(
        message.startswith("Replacing can_csv Superset with ")
        and message.endswith(" on Legacy")
        for message in messages
    )
    assert not any("NoExport" in message for message in messages)


def test_is_idempotent(session: Session) -> None:
    can_csv = _make_pvm(session, "can_csv")
    session.add(Role(name="Analyst", permissions=[can_csv]))
    session.commit()

    migration.do_upgrade(session)
    session.commit()
    first = _perm_names(session, "Analyst")
    migration.do_upgrade(session)
    session.commit()

    assert _perm_names(session, "Analyst") == first == GRANULAR
    assert not _can_csv_exists(session)


def test_upgrade_persists_conversion_when_can_csv_is_kept(
    session: Session, mocker: MockerFixture
) -> None:
    """``upgrade()`` must commit its own session: when ``can_csv`` is kept no
    query runs after the role changes, so nothing autoflushes them."""
    can_csv = _make_pvm(session, "can_csv")
    export_data = _make_pvm(session, "can_export_data")
    session.add(Role(name="Legacy", permissions=[can_csv]))
    session.add(Role(name="Curated", permissions=[can_csv, export_data]))
    session.commit()

    mocker.patch.object(migration, "op").get_bind.return_value = session.get_bind()
    migration.upgrade()
    session.expire_all()

    assert _perm_names(session, "Legacy") == GRANULAR
    assert _perm_names(session, "Curated") == {"can_csv", "can_export_data"}
