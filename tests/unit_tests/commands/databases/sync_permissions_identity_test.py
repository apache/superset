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

The Celery task only ever receives a ``username`` string (the async
enqueue-to-execute boundary does not carry the enqueuing user's immutable
id). At execution time it resolves that string to a user record via
``security_manager.get_user_by_username`` and binds the result to
``flask.g.user`` for the duration of the sync. Whoever currently holds that
username at *execution* time -- not whoever held it at *enqueue* time -- is
the identity the rest of the sync runs under.

That identity is not just used for logging: ``Database._get_sqla_engine``
reads ``g.user.id`` to look up a per-user OAuth2 access token, and, for
databases with ``impersonate_user`` enabled, ``Database.get_effective_user``
reads ``g.user.username`` (via ``get_username()``) to pick the identity the
outgoing connection impersonates at the external database. These tests pin
down both halves of that chain: the mutable-username resolution in the task,
and the fact that the resolved user is what a privileged, identity-sensitive
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


def test_task_binds_g_user_to_whoever_currently_holds_the_username(
    mocker: MockerFixture,
) -> None:
    """
    The task resolves its acting identity from the username string at
    execution time. If a different user now holds that username than the
    one who held it when the task was enqueued, the task binds ``g.user``
    to that *different*, current user -- not to any identity captured at
    enqueue time (no user id ever crosses the enqueue/execute boundary).
    """
    # Whoever enqueued the task saw this identity for "alice" at enqueue
    # time. It is never passed to the task -- only the string "alice" is.
    original_alice = MagicMock()
    original_alice.id = 101
    original_alice.username = "alice"

    # By the time the task executes, "alice" resolves to a different user
    # record (e.g. the original account was renamed and the username was
    # subsequently reassigned).
    reassigned_alice = MagicMock()
    reassigned_alice.id = 999
    reassigned_alice.username = "alice"

    get_user_mock = mocker.patch(
        "superset.commands.database.sync_permissions.security_manager"
        ".get_user_by_username",
        return_value=reassigned_alice,
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

    sync_database_permissions_task(1, "alice", "old_db_name")

    # Resolution happened purely off the mutable username string...
    get_user_mock.assert_called_once_with("alice")
    # ...and the sync ran under whichever user currently holds "alice" at
    # execution time -- the reassigned user, not the original enqueuer.
    assert observed_g_user == [reassigned_alice]
    assert observed_g_user[0].id != original_alice.id


def test_g_user_bound_by_the_task_drives_external_db_impersonation_identity(
    mocker: MockerFixture,
) -> None:
    """
    ``Database.get_effective_user`` -- consulted by ``_get_sqla_engine`` to
    decide which identity an outgoing, ``impersonate_user``-enabled
    connection impersonates at the external database -- reads
    ``g.user.username``. Whatever user object the task bound to ``g.user``
    (per the previous test, the *current* holder of the username, which can
    differ from the task's original enqueuer) is therefore the identity
    used to connect to the external database, not a fixed identity captured
    when the task was queued.
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

    # A different user bound to g.user (as would happen if the task
    # resolved a reassigned username) changes the impersonated identity
    # for the exact same database configuration and target URL.
    user_b = MagicMock()
    user_b.username = "user_b"
    mocker.patch("superset.utils.core.g", MagicMock(user=user_b))
    assert Database.get_effective_user(database, object_url) == "user_b"
