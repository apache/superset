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
from __future__ import annotations

import pytest
from sqlalchemy.orm.session import Session

from superset.models.signals import (
    after_delete,
    after_insert,
    after_update,
    before_insert,
    before_update,
    ModelChangeEvent,
)


@pytest.fixture
def dashboard_session(session: Session) -> Session:
    """Session with Dashboard tables created."""
    from superset.models.dashboard import Dashboard

    Dashboard.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    return session


def test_insert_fires_before_and_after_insert(dashboard_session):
    """Inserting a model fires before_insert and after_insert with correct payload."""
    from superset.models.dashboard import Dashboard

    received: list[ModelChangeEvent] = []

    def on_event(sender, event, **kw):
        received.append(event)

    before_insert.connect(on_event, sender=Dashboard)
    after_insert.connect(on_event, sender=Dashboard)
    try:
        dash = Dashboard(dashboard_title="Signal Test", slug="signal-test")
        dashboard_session.add(dash)
        dashboard_session.flush()

        assert len(received) == 2
        assert received[0].action == "before_insert"
        assert received[0].model is dash
        assert received[0].model_type == "dashboards"
        assert received[1].action == "after_insert"
        assert received[1].model is dash
    finally:
        dashboard_session.rollback()
        before_insert.disconnect(on_event, sender=Dashboard)
        after_insert.disconnect(on_event, sender=Dashboard)


def test_update_fires_before_and_after_update(dashboard_session):
    """Updating a model fires before_update and after_update."""
    from superset.models.dashboard import Dashboard

    received: list[ModelChangeEvent] = []

    def on_event(sender, event, **kw):
        received.append(event)

    dash = Dashboard(dashboard_title="Original", slug="update-test")
    dashboard_session.add(dash)
    dashboard_session.flush()

    before_update.connect(on_event, sender=Dashboard)
    after_update.connect(on_event, sender=Dashboard)
    try:
        dash.dashboard_title = "Updated"
        dashboard_session.flush()

        assert len(received) == 2
        assert received[0].action == "before_update"
        assert received[1].action == "after_update"
        assert received[1].model.dashboard_title == "Updated"
    finally:
        dashboard_session.rollback()
        before_update.disconnect(on_event, sender=Dashboard)
        after_update.disconnect(on_event, sender=Dashboard)


def test_delete_fires_after_delete(dashboard_session):
    """Deleting a model fires after_delete."""
    from superset.models.dashboard import Dashboard

    received: list[ModelChangeEvent] = []

    def on_event(sender, event, **kw):
        received.append(event)

    dash = Dashboard(dashboard_title="To Delete", slug="delete-test")
    dashboard_session.add(dash)
    dashboard_session.flush()

    after_delete.connect(on_event, sender=Dashboard)
    try:
        dashboard_session.delete(dash)
        dashboard_session.flush()

        assert len(received) == 1
        assert received[0].action == "after_delete"
        assert received[0].model is dash
    finally:
        dashboard_session.rollback()
        after_delete.disconnect(on_event, sender=Dashboard)


def test_sender_filtering_across_models(dashboard_session):
    """A handler connected to Dashboard does not fire for Slice operations."""
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    dashboard_events: list[ModelChangeEvent] = []

    def on_dashboard_insert(sender, event, **kw):
        dashboard_events.append(event)

    after_insert.connect(on_dashboard_insert, sender=Dashboard)
    try:
        chart = Slice(
            slice_name="Test Chart",
            datasource_type="table",
            viz_type="table",
        )
        dashboard_session.add(chart)
        dashboard_session.flush()

        assert len(dashboard_events) == 0

        dash = Dashboard(dashboard_title="Test Dash", slug="filter-test")
        dashboard_session.add(dash)
        dashboard_session.flush()

        assert len(dashboard_events) == 1
        assert dashboard_events[0].model is dash
    finally:
        dashboard_session.rollback()
        after_insert.disconnect(on_dashboard_insert, sender=Dashboard)


def test_before_insert_can_modify_model(dashboard_session):
    """A before_insert handler can modify the model before SQL executes."""
    from superset.models.dashboard import Dashboard

    def set_slug(sender, event, **kw):
        if not event.model.slug:
            event.model.slug = "auto-slug"

    before_insert.connect(set_slug, sender=Dashboard)
    try:
        dash = Dashboard(dashboard_title="No Slug")
        dashboard_session.add(dash)
        dashboard_session.flush()

        assert dash.slug == "auto-slug"
    finally:
        dashboard_session.rollback()
        before_insert.disconnect(set_slug, sender=Dashboard)


def test_signals_fire_within_transaction(dashboard_session):
    """Signals fire during flush, before commit — rollback undoes everything."""
    from superset.models.dashboard import Dashboard

    received: list[ModelChangeEvent] = []

    def on_insert(sender, event, **kw):
        received.append(event)

    after_insert.connect(on_insert, sender=Dashboard)
    try:
        dash = Dashboard(dashboard_title="Rollback Test", slug="rollback-test")
        dashboard_session.add(dash)
        dashboard_session.flush()

        assert len(received) == 1

        dashboard_session.rollback()

        assert (
            dashboard_session.query(Dashboard).filter_by(slug="rollback-test").first()
            is None
        )
        # Signal still fired during the transaction
        assert len(received) == 1
    finally:
        after_insert.disconnect(on_insert, sender=Dashboard)


def test_idempotent_connect(dashboard_session):
    """Connecting the same handler+sender twice does not cause double-firing."""
    from superset.models.dashboard import Dashboard

    call_count = 0

    def handler(sender, event, **kw):
        nonlocal call_count
        call_count += 1

    after_insert.connect(handler, sender=Dashboard)
    after_insert.connect(handler, sender=Dashboard)
    try:
        dash = Dashboard(dashboard_title="Idempotent", slug="idempotent-test")
        dashboard_session.add(dash)
        dashboard_session.flush()

        assert call_count == 1
    finally:
        dashboard_session.rollback()
        after_insert.disconnect(handler, sender=Dashboard)
