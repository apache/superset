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

from unittest.mock import MagicMock

import pytest

from superset.models.signals import (
    after_delete,
    after_insert,
    after_update,
    before_insert,
    before_update,
    ModelChangeEvent,
    SignalMixin,
)


def test_signal_mixin_skips_abstract_base(monkeypatch):
    """SignalMixin does not register events on classes without __tablename__."""

    listen_calls = []

    def _record_listen(*args, **kwargs):
        listen_calls.append((args, kwargs))

    monkeypatch.setattr("superset.models.signals.sa.event.listen", _record_listen)

    class AbstractBase(SignalMixin):
        pass

    # No __tablename__ in __dict__, so __init_subclass__ should skip registration
    assert listen_calls == []


def test_model_change_event_fields():
    """ModelChangeEvent stores all expected fields."""
    mapper = MagicMock()
    connection = MagicMock()
    model = MagicMock()

    event = ModelChangeEvent(
        model_type="dashboards",
        action="after_insert",
        model_id=42,
        model=model,
        mapper=mapper,
        connection=connection,
    )

    assert event.model_type == "dashboards"
    assert event.action == "after_insert"
    assert event.model_id == 42
    assert event.model is model
    assert event.mapper is mapper
    assert event.connection is connection
    assert event.timestamp is not None


def test_signal_emission_with_sender_filtering():
    """Signals fire with sender=ModelClass, enabling per-model filtering."""
    received_events: list[ModelChangeEvent] = []

    class SenderA:
        pass

    class SenderB:
        pass

    def handler_a(sender, event, **kw):
        received_events.append(event)

    # Connect only to SenderA
    after_insert.connect(handler_a, sender=SenderA)

    try:
        mock_mapper = MagicMock()
        mock_conn = MagicMock()

        event_a = ModelChangeEvent(
            model_type="test_a",
            action="after_insert",
            model_id=1,
            model=MagicMock(),
            mapper=mock_mapper,
            connection=mock_conn,
        )
        after_insert.send(SenderA, event=event_a)

        assert len(received_events) == 1
        assert received_events[0].model_type == "test_a"

        # Fire for SenderB — handler_a should NOT receive it
        event_b = ModelChangeEvent(
            model_type="test_b",
            action="after_insert",
            model_id=2,
            model=MagicMock(),
            mapper=mock_mapper,
            connection=mock_conn,
        )
        after_insert.send(SenderB, event=event_b)

        # Still only 1 event received
        assert len(received_events) == 1
    finally:
        after_insert.disconnect(handler_a, sender=SenderA)


def test_global_handler_receives_all_signals():
    """A handler connected without sender receives signals from all senders."""
    received_events: list[ModelChangeEvent] = []

    class SenderX:
        pass

    class SenderY:
        pass

    def global_handler(sender, event, **kw):
        received_events.append(event)

    after_update.connect(global_handler)

    try:
        mock_mapper = MagicMock()
        mock_conn = MagicMock()

        for sender, name in [(SenderX, "x"), (SenderY, "y")]:
            event = ModelChangeEvent(
                model_type=name,
                action="after_update",
                model_id=1,
                model=MagicMock(),
                mapper=mock_mapper,
                connection=mock_conn,
            )
            after_update.send(sender, event=event)

        assert len(received_events) == 2
    finally:
        after_update.disconnect(global_handler)


def test_all_five_signals_exist():
    """All five expected signals are available."""
    assert before_insert.name == "superset.before_insert"
    assert before_update.name == "superset.before_update"
    assert after_insert.name == "superset.after_insert"
    assert after_update.name == "superset.after_update"
    assert after_delete.name == "superset.after_delete"


def test_model_change_event_is_frozen():
    """ModelChangeEvent is immutable (frozen dataclass)."""
    event = ModelChangeEvent(
        model_type="test",
        action="after_insert",
        model_id=1,
        model=MagicMock(),
        mapper=MagicMock(),
        connection=MagicMock(),
    )
    with pytest.raises(AttributeError):
        event.model_type = "changed"
