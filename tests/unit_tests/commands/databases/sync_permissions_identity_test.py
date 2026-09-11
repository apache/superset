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
"""
Traces how ``sync_database_permissions_task`` binds an acting identity.

The Celery task receives the immutable ``id`` of the user who enqueued it
(captured at enqueue time by ``SyncPermissionsCommand.validate``), not a
mutable username string. At execution time it resolves that id to a user
record via ``security_manager.get_user_by_id`` and binds the result to
``flask.g.user`` for the duration of the sync. Because resolution is by id,
a username change between enqueue and execution has no effect on which user
record the task acts as.

That identity is not just used for logging: ``Database._get_sqla_engine``
reads ``g.user.id`` to look up a per-user OAuth2 access token, and, for
databases with ``impersonate_user`` enabled, ``Database.get_effective_user``
reads ``g.user.username`` (via ``get_username()``) to pick the identity the
outgoing connection impersonates at the external database. These tests pin
down both halves of that chain: the id-based resolution in the task, and the
fact that the resolved user is what a privileged, identity-sensitive
codepath consumes downstream.
"""

from __future__ import annotations

from unittest.mock import MagicMock

from flask import g
from pytest_mock import MockerFixture

from superset.commands.database.sync_permissions import (
    sync_database_permissions_task,
)
from superset.models.core import Database


def test_task_binds_g_user_to_whoever_held_the_id_at_enqueue_time(
    mocker: MockerFixture,
) -> None:
    """
    The task resolves its acting identity from the user id captured at
    enqueue time, via ``security_manager.get_user_by_id``. A username change
    that happens between enqueue and execution has no effect on which user
    record the task binds ``g.user`` to, because the id -- not the mutable
    username -- is what crosses the enqueue/execute boundary.
    """
    # Whoever enqueued the task saw this identity at enqueue time. Its id is
    # what's passed to the task.
    enqueuing_user = MagicMock()
    enqueuing_user.id = 101
    enqueuing_user.username = "alice"

    get_user_mock = mocker.patch(
        "superset.commands.database.sync_permissions.security_manager.get_user_by_id",
        return_value=enqueuing_user,
    )

    mock_db_connection = MagicMock()
    mocker.patch(
        "superset.commands.database.sync_permissions.DatabaseDAO.find_by_id",
        return_value=mock_db_connection,
    )

    observed_g_user: list[MagicMock] = []

    def capture_g_user(self: object) -> None:
        # Read g.user at the moment the sync logic actually runs, the same
        # way privileged downstream code (e.g. _get_sqla_engine) would.
        observed_g_user.append(g.user)

    mocker.patch(
        "superset.commands.database.sync_permissions.SyncPermissionsCommand"
        ".sync_database_permissions",
        autospec=True,
        side_effect=capture_g_user,
    )

    # By the time the task executes, "alice" has been renamed (and the
    # username could even have been reassigned to someone else) -- but the
    # task was enqueued with id 101, so the rename doesn't affect resolution.
    enqueuing_user.username = "alice_renamed"

    sync_database_permissions_task(1, 101, "old_db_name")

    # Resolution happened purely off the immutable id...
    get_user_mock.assert_called_once_with(101)
    # ...and the sync ran under the same user captured at enqueue time,
    # regardless of the username change in between.
    assert observed_g_user == [enqueuing_user]
    assert observed_g_user[0].id == 101


def test_g_user_bound_by_the_task_drives_external_db_impersonation_identity(
    mocker: MockerFixture,
) -> None:
    """
    ``Database.get_effective_user`` -- consulted by ``_get_sqla_engine`` to
    decide which identity an outgoing, ``impersonate_user``-enabled
    connection impersonates at the external database -- reads
    ``g.user.username``. Whatever user object the task bound to ``g.user``
    (per the previous test, the user resolved from the id captured at
    enqueue time) is therefore the identity used to connect to the external
    database.
    """
    database = MagicMock(spec=Database)
    database.impersonate_user = True

    object_url = MagicMock()
    object_url.username = "url-embedded-user"

    # ``get_effective_user`` calls ``get_username()``, which reads
    # ``g.user.username`` using the ``g`` imported into
    # ``superset.utils.core`` (where ``get_username`` is defined) -- patch
    # that module's ``g``, matching what the running task actually touches.
    user_a = MagicMock()
    user_a.username = "user_a"
    mocker.patch("superset.utils.core.g", MagicMock(user=user_a))
    assert Database.get_effective_user(database, object_url) == "user_a"

    # A different user bound to g.user (as would happen if a different id
    # had been captured at enqueue time) changes the impersonated identity
    # for the exact same database configuration and target URL.
    user_b = MagicMock()
    user_b.username = "user_b"
    mocker.patch("superset.utils.core.g", MagicMock(user=user_b))
    assert Database.get_effective_user(database, object_url) == "user_b"
