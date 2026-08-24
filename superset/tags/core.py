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

from superset.utils.sqlalchemy_events import (
    DeleteListenerDeclaration,
    DeleteListenerEffect,
    register_delete_listener,
    remove_delete_listener,
)


def _tag_delete_listener_declarations() -> tuple[DeleteListenerDeclaration, ...]:
    """Build tag cleanup declarations without introducing model import cycles."""
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.tags.models import ChartUpdater, DashboardUpdater, DatasetUpdater

    return (
        DeleteListenerDeclaration(
            SqlaTable,
            "tagged_object_cleanup",
            DeleteListenerEffect.PERSISTENT_RECORD,
            DatasetUpdater.after_delete,
        ),
        DeleteListenerDeclaration(
            Slice,
            "tagged_object_cleanup",
            DeleteListenerEffect.PERSISTENT_RECORD,
            ChartUpdater.after_delete,
        ),
        DeleteListenerDeclaration(
            Dashboard,
            "tagged_object_cleanup",
            DeleteListenerEffect.PERSISTENT_RECORD,
            DashboardUpdater.after_delete,
        ),
    )


def register_sqla_event_listeners() -> None:
    """Register cleanup of ``tagged_object`` rows on object deletion.

    Only deletion is handled here: Superset no longer auto-generates
    ``type:``/``editor:``/``favorited_by:`` tags (see ``TagType``'s docstring),
    so there's nothing left to do on insert/update. Deletion cleanup stays,
    since it applies to every tag on the object, custom tags included, and
    ``tagged_object.object_id`` has no foreign key to cascade on its own.
    """
    import sqlalchemy as sqla

    from superset.models.sql_lab import SavedQuery
    from superset.tags.models import QueryUpdater

    declarations = _tag_delete_listener_declarations()

    register_delete_listener(declarations[0])  # dataset
    register_delete_listener(declarations[1])  # chart
    register_delete_listener(declarations[2])  # dashboard

    sqla.event.listen(SavedQuery, "after_delete", QueryUpdater.after_delete)


def clear_sqla_event_listeners() -> None:
    import sqlalchemy as sqla

    from superset.models.sql_lab import SavedQuery
    from superset.tags.models import QueryUpdater

    declarations = _tag_delete_listener_declarations()

    remove_delete_listener(declarations[0])  # dataset
    remove_delete_listener(declarations[1])  # chart
    remove_delete_listener(declarations[2])  # dashboard

    sqla.event.remove(SavedQuery, "after_delete", QueryUpdater.after_delete)
