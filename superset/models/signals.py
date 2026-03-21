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
"""Blinker signal infrastructure for Superset model lifecycle events.

Provides five blinker signals that mirror SQLAlchemy mapper events:
- ``before_insert``, ``before_update`` — fire during flush, before SQL
- ``after_insert``, ``after_update``, ``after_delete`` — fire after SQL, within txn

Usage::

    from superset.models.signals import after_insert
    from superset.models.dashboard import Dashboard

    # Listen to Dashboard inserts only
    after_insert.connect(handler, sender=Dashboard)

    # Listen to ALL model inserts
    after_insert.connect(handler)

    # Decorator style
    @after_insert.connect_via(Dashboard)
    def on_dashboard_insert(sender, event, **kwargs):
        ...
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import blinker
import sqlalchemy as sa

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Signals — named to match the SQLA mapper events they wrap
# ---------------------------------------------------------------------------

before_insert: blinker.NamedSignal = blinker.signal("superset.before_insert")
before_update: blinker.NamedSignal = blinker.signal("superset.before_update")
after_insert: blinker.NamedSignal = blinker.signal("superset.after_insert")
after_update: blinker.NamedSignal = blinker.signal("superset.after_update")
after_delete: blinker.NamedSignal = blinker.signal("superset.after_delete")


# ---------------------------------------------------------------------------
# Event payload — mirrors FAB's SecurityModelChangeEvent
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ModelChangeEvent:
    """Payload delivered with every model signal."""

    model_type: str
    action: str
    model_id: Any
    model: Any
    mapper: sa.orm.Mapper
    connection: sa.engine.Connection
    timestamp: datetime = field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Mixin — auto-registers SQLA listeners via __init_subclass__
# ---------------------------------------------------------------------------

# Map SQLA event names → blinker signal instances
_EVENT_SIGNAL_MAP: dict[str, blinker.NamedSignal] = {
    "before_insert": before_insert,
    "before_update": before_update,
    "after_insert": after_insert,
    "after_update": after_update,
    "after_delete": after_delete,
}


def _make_listener(event_name: str, signal: blinker.NamedSignal) -> Any:
    """Create an SQLA event listener that fires the corresponding blinker signal."""

    def _listener(
        mapper: sa.orm.Mapper, connection: sa.engine.Connection, target: Any
    ) -> None:
        pk = sa.inspect(target).identity
        event = ModelChangeEvent(
            model_type=getattr(target, "__tablename__", type(target).__name__),
            action=event_name,
            model_id=pk[0] if pk and len(pk) == 1 else pk,
            model=target,
            mapper=mapper,
            connection=connection,
        )
        signal.send(type(target), event=event)

    _listener.__name__ = f"_signal_{event_name}"
    _listener.__qualname__ = f"SignalMixin._signal_{event_name}"
    return _listener


class SignalMixin:
    """Mixin that auto-registers SQLA mapper event listeners on concrete models.

    Only registers on subclasses that define ``__tablename__`` in their own
    ``__dict__`` (i.e. concrete mapped classes), skipping abstract bases like
    ``BaseDatasource``.
    """

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        if "__tablename__" not in cls.__dict__:
            return

        for event_name, signal in _EVENT_SIGNAL_MAP.items():
            listener = _make_listener(event_name, signal)
            sa.event.listen(cls, event_name, listener)

        logger.debug("SignalMixin: registered signals for %s", cls.__name__)
