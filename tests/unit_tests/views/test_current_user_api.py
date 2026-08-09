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
"""Unit tests for the ``CurrentUserRestApi`` self-service update flow.

Covers the ``password`` handling in ``PUT /api/v1/me/``: whether the caller
must prove knowledge of the existing password, and whether the value that
ends up persisted is the hash computed in ``pre_update`` or the raw value
from the request payload.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

from flask_appbuilder.security.sqla.models import User
from werkzeug.security import check_password_hash

from superset import db
from superset.daos.user import UserDAO
from superset.views.users.api import CurrentUserRestApi
from superset.views.users.schemas import CurrentUserPutSchema
from tests.unit_tests.fixtures.common import admin_user, after_each  # noqa: F401


def _run_update_me(user: User, data: dict[str, Any]) -> None:
    """Reproduce the body of ``CurrentUserRestApi.update_me`` for ``data``.

    Exercises the same two calls the endpoint makes -- ``pre_update`` followed
    by ``UserDAO.update`` with the schema-loaded payload as ``attributes`` --
    without going through HTTP/auth plumbing, since neither call depends on it.
    """
    api = CurrentUserRestApi()
    with patch("superset.views.users.api.g") as mock_g:
        mock_g.user = user
        api.pre_update(user, data)
        UserDAO.update(item=user, attributes=data)


def test_current_user_put_schema_has_no_current_password_field() -> None:
    """The payload schema for ``PUT /api/v1/me/`` carries no field for proving
    knowledge of the existing password -- a ``password`` key alone is enough
    to change it.
    """
    fields = CurrentUserPutSchema().fields

    assert "password" in fields
    assert "current_password" not in fields
    assert "old_password" not in fields


def test_update_me_changes_password_without_proof_of_current_password(
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    """A caller with an authenticated session can change the password by
    supplying only the new value -- no current-password (or other fresh-auth)
    field is read or checked anywhere in the update path.
    """
    original_password = admin_user.password

    _run_update_me(admin_user, {"password": "BrandNewPassw0rd!"})
    db.session.flush()

    assert admin_user.password != original_password


def test_update_me_password_change_persists_a_hash_not_plaintext(
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    """``pre_update`` computes ``generate_password_hash(data["password"])`` and
    assigns it to the user, but ``UserDAO.update`` is then called with the
    *same* ``data`` dict as ``attributes`` -- and that dict still has the
    plaintext ``password`` key. ``BaseDAO.update`` blindly ``setattr``s every
    key in ``attributes``, so the plaintext overwrites the hash that was just
    computed, and the plaintext password is what actually reaches the
    database.
    """
    new_password = "BrandNewPassw0rd!"  # noqa: S105

    _run_update_me(admin_user, {"password": new_password})
    db.session.flush()

    stored_password = admin_user.password

    # The stored value should be a password hash that verifies against the
    # new password -- not the plaintext value itself.
    assert stored_password != new_password
    assert check_password_hash(stored_password, new_password)
