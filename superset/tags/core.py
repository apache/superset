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
# pylint: disable=import-outside-toplevel
from __future__ import annotations

import warnings
from typing import Any, Callable

import blinker


def _get_tag_signal_bindings() -> list[
    tuple[blinker.NamedSignal, Callable[..., Any], type]
]:
    """Return (signal, handler, sender) triples for all tag handlers."""
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import FavStar
    from superset.models.dashboard import Dashboard
    from superset.models.signals import after_delete, after_insert, after_update
    from superset.models.slice import Slice
    from superset.models.sql_lab import SavedQuery
    from superset.tags.models import (
        ChartUpdater,
        DashboardUpdater,
        DatasetUpdater,
        FavStarUpdater,
        QueryUpdater,
    )

    return [
        (after_insert, DatasetUpdater.on_after_insert, SqlaTable),
        (after_update, DatasetUpdater.on_after_update, SqlaTable),
        (after_delete, DatasetUpdater.on_after_delete, SqlaTable),
        (after_insert, ChartUpdater.on_after_insert, Slice),
        (after_update, ChartUpdater.on_after_update, Slice),
        (after_delete, ChartUpdater.on_after_delete, Slice),
        (after_insert, DashboardUpdater.on_after_insert, Dashboard),
        (after_update, DashboardUpdater.on_after_update, Dashboard),
        (after_delete, DashboardUpdater.on_after_delete, Dashboard),
        (after_insert, FavStarUpdater.on_after_insert, FavStar),
        (after_delete, FavStarUpdater.on_after_delete, FavStar),
        (after_insert, QueryUpdater.on_after_insert, SavedQuery),
        (after_update, QueryUpdater.on_after_update, SavedQuery),
        (after_delete, QueryUpdater.on_after_delete, SavedQuery),
    ]


def connect_tag_signal_handlers() -> None:
    """Connect blinker signal handlers for the tagging system."""
    for signal, handler, sender in _get_tag_signal_bindings():
        signal.connect(handler, sender=sender)


def disconnect_tag_signal_handlers() -> None:
    """Disconnect blinker signal handlers for the tagging system."""
    for signal, handler, sender in _get_tag_signal_bindings():
        signal.disconnect(handler, sender=sender)


# Backward-compatible aliases (deprecated, will be removed in 7.0)


def register_sqla_event_listeners() -> None:
    """Deprecated: Use connect_tag_signal_handlers(). Will be removed in 7.0."""
    warnings.warn(
        "register_sqla_event_listeners is deprecated, use connect_tag_signal_handlers",
        DeprecationWarning,
        stacklevel=2,
    )
    connect_tag_signal_handlers()


def clear_sqla_event_listeners() -> None:
    """Deprecated: Use disconnect_tag_signal_handlers(). Will be removed in 7.0."""
    warnings.warn(
        "clear_sqla_event_listeners is deprecated, use disconnect_tag_signal_handlers",
        DeprecationWarning,
        stacklevel=2,
    )
    disconnect_tag_signal_handlers()
