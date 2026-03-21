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
"""Centralized blinker signal handlers for Superset model lifecycle events.

Replaces scattered ``sqla.event.listen()`` registrations with a single module
that connects blinker signal handlers.  Each adapter unpacks the
``ModelChangeEvent`` and calls the original handler with the expected
``(mapper, connection, target)`` signature.
"""

from __future__ import annotations

import logging
from typing import Any, Callable

import blinker

from superset.models.signals import (
    after_delete,
    after_insert,
    after_update,
    before_insert,
    before_update,
    ModelChangeEvent,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Security / permission handlers (always-on)
# ---------------------------------------------------------------------------


def _database_after_insert(sender: Any, event: ModelChangeEvent, **kw: Any) -> None:
    from superset import security_manager

    security_manager.database_after_insert(event.mapper, event.connection, event.model)


def _database_after_update(sender: Any, event: ModelChangeEvent, **kw: Any) -> None:
    from superset import security_manager

    security_manager.database_after_update(event.mapper, event.connection, event.model)


def _database_after_delete(sender: Any, event: ModelChangeEvent, **kw: Any) -> None:
    from superset import security_manager

    security_manager.database_after_delete(event.mapper, event.connection, event.model)


def _sqla_table_before_update(sender: Any, event: ModelChangeEvent, **kw: Any) -> None:
    from superset import security_manager

    event.model.load_database()
    security_manager.dataset_before_update(event.mapper, event.connection, event.model)


def _sqla_table_after_insert(sender: Any, event: ModelChangeEvent, **kw: Any) -> None:
    from superset import security_manager

    event.model.load_database()
    security_manager.dataset_after_insert(event.mapper, event.connection, event.model)


def _sqla_table_after_delete(sender: Any, event: ModelChangeEvent, **kw: Any) -> None:
    from superset import security_manager

    security_manager.dataset_after_delete(event.mapper, event.connection, event.model)


def _slice_set_related_perm(sender: Any, event: ModelChangeEvent, **kw: Any) -> None:
    from superset.models.slice import set_related_perm

    set_related_perm(event.mapper, event.connection, event.model)


# ---------------------------------------------------------------------------
# Thumbnail handlers (conditional on THUMBNAILS_SQLA_LISTENERS)
# ---------------------------------------------------------------------------


def _dashboard_update_thumbnail(
    sender: Any, event: ModelChangeEvent, **kw: Any
) -> None:
    event.model.update_thumbnail()


def _chart_update_thumbnail(sender: Any, event: ModelChangeEvent, **kw: Any) -> None:
    from superset.models.slice import event_after_chart_changed

    event_after_chart_changed(event.mapper, event.connection, event.model)


def _get_thumbnail_bindings() -> list[
    tuple[blinker.NamedSignal, Callable[..., Any], type]
]:
    """Return (signal, handler, sender) triples for thumbnail handlers."""
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    return [
        (after_insert, _dashboard_update_thumbnail, Dashboard),
        (after_update, _dashboard_update_thumbnail, Dashboard),
        (after_insert, _chart_update_thumbnail, Slice),
        (after_update, _chart_update_thumbnail, Slice),
    ]


# ---------------------------------------------------------------------------
# Registration functions
# ---------------------------------------------------------------------------


def connect_security_handlers() -> None:
    """Connect security/permission signal handlers.

    Should be called from ``init_app_in_ctx()`` before any model operations.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.slice import Slice

    after_insert.connect(_database_after_insert, sender=Database)
    after_update.connect(_database_after_update, sender=Database)
    after_delete.connect(_database_after_delete, sender=Database)

    before_update.connect(_sqla_table_before_update, sender=SqlaTable)
    after_insert.connect(_sqla_table_after_insert, sender=SqlaTable)
    after_delete.connect(_sqla_table_after_delete, sender=SqlaTable)

    before_insert.connect(_slice_set_related_perm, sender=Slice)
    before_update.connect(_slice_set_related_perm, sender=Slice)

    logger.debug("Connected security signal handlers")


def connect_thumbnail_handlers() -> None:
    """Connect thumbnail signal handlers.

    Should be called from ``sync_config_to_db()`` when
    ``THUMBNAILS_SQLA_LISTENERS`` is enabled.
    """
    for signal, handler, sender in _get_thumbnail_bindings():
        signal.connect(handler, sender=sender)
    logger.debug("Connected thumbnail signal handlers")


def disconnect_thumbnail_handlers() -> None:
    """Disconnect thumbnail signal handlers."""
    for signal, handler, sender in _get_thumbnail_bindings():
        signal.disconnect(handler, sender=sender)
    logger.debug("Disconnected thumbnail signal handlers")
