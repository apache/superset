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
"""Tests for the saved widget commands, using real database rows."""

from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import create_engine, event, update
from sqlalchemy.engine import Engine
from sqlalchemy.orm.session import Session

from superset.commands.widget.create import CreateWidgetCommand
from superset.commands.widget.delete import DeleteWidgetCommand
from superset.commands.widget.exceptions import (
    WidgetForbiddenError,
    WidgetNotFoundError,
    WidgetRevisionConflictError,
)
from superset.commands.widget.update import UpdateWidgetCommand
from superset.utils.core import override_user
from superset.widgets.models import Widget
from tests.unit_tests.widgets.fixtures import MakeUser, MakeWidget


@pytest.fixture
def session_engine(tmp_path: Path) -> Engine:
    """
    Back this module's ``session`` with a file database, so a second connection
    can commit independently and simulate a concurrent writer.
    """
    return create_engine(f"sqlite:///{tmp_path / 'widgets.db'}")


def test_create_defaults_editors_to_the_creator(
    tables: Session, make_user: MakeUser
) -> None:
    alice_user, alice = make_user("alice", "Gamma")
    tables.commit()

    with override_user(alice_user):
        widget = CreateWidgetCommand(
            {"widget_type": "markdown", "name": "Notes", "props": {"content": "Hi"}}
        ).run()

    assert widget.uuid is not None
    assert widget.revision == 1
    assert widget.schema_version == 1
    assert widget.props == {"content": "Hi"}
    assert widget.editors == [alice]


def test_update_bumps_the_revision(
    tables: Session, make_user: MakeUser, make_widget: MakeWidget
) -> None:
    alice_user, alice = make_user("alice", "Gamma")
    widget = make_widget("Notes", editors=[alice])
    tables.commit()

    with override_user(alice_user):
        updated = UpdateWidgetCommand(
            str(widget.uuid), {"name": "Renamed"}, expected_revision=1
        ).run()

    assert updated.name == "Renamed"
    assert updated.revision == 2


def test_update_rejects_a_stale_expected_revision(
    tables: Session, make_user: MakeUser, make_widget: MakeWidget
) -> None:
    alice_user, alice = make_user("alice", "Gamma")
    widget = make_widget("Notes", editors=[alice])
    tables.commit()

    with override_user(alice_user):
        UpdateWidgetCommand(str(widget.uuid), {"name": "First"}).run()
        with pytest.raises(WidgetRevisionConflictError) as excinfo:
            UpdateWidgetCommand(
                str(widget.uuid), {"name": "Second"}, expected_revision=1
            ).run()

    assert excinfo.value.current_revision == 2
    assert tables.get(Widget, widget.id).name == "First"


def test_update_detects_a_concurrent_write(
    tables: Session,
    session_engine: Engine,
    make_user: MakeUser,
    make_widget: MakeWidget,
) -> None:
    alice_user, alice = make_user("alice", "Gamma")
    widget = make_widget("Notes", editors=[alice])
    tables.commit()

    # Another writer commits after the command has read the widget at revision
    # 1, but before the command writes it back.
    @event.listens_for(tables, "before_flush", once=True)
    def _concurrent_write(*args: Any) -> None:
        with session_engine.begin() as other_writer:
            other_writer.execute(
                update(Widget.__table__)
                .where(Widget.__table__.c.id == widget.id)
                .values(name="Concurrent", revision=2)
            )

    with override_user(alice_user):
        with pytest.raises(WidgetRevisionConflictError) as excinfo:
            UpdateWidgetCommand(str(widget.uuid), {"name": "Mine"}).run()

    assert excinfo.value.current_revision == 2
    tables.expire_all()
    assert tables.get(Widget, widget.id).name == "Concurrent"


def test_non_editors_cannot_update_or_delete(
    tables: Session, make_user: MakeUser, make_widget: MakeWidget
) -> None:
    _, alice = make_user("alice", "Gamma")
    bob_user, bob = make_user("bob", "Gamma")
    widget = make_widget("Notes", editors=[alice], viewers=[bob])
    tables.commit()

    with override_user(bob_user):
        with pytest.raises(WidgetForbiddenError):
            UpdateWidgetCommand(str(widget.uuid), {"name": "Mine"}).run()
        with pytest.raises(WidgetForbiddenError):
            DeleteWidgetCommand(str(widget.uuid)).run()


def test_unreadable_widgets_are_not_found(
    tables: Session, make_user: MakeUser, make_widget: MakeWidget
) -> None:
    _, alice = make_user("alice", "Gamma")
    carol_user, _ = make_user("carol", "Gamma")
    widget = make_widget("Notes", editors=[alice])
    tables.commit()

    with override_user(carol_user):
        with pytest.raises(WidgetNotFoundError):
            UpdateWidgetCommand(str(widget.uuid), {"name": "Mine"}).run()


def test_delete_removes_the_widget(
    tables: Session, make_user: MakeUser, make_widget: MakeWidget
) -> None:
    alice_user, alice = make_user("alice", "Gamma")
    widget = make_widget("Notes", editors=[alice])
    tables.commit()

    with override_user(alice_user):
        DeleteWidgetCommand(str(widget.uuid)).run()

    assert tables.query(Widget).count() == 0
