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

import pytest
from flask_appbuilder.security.sqla.models import User
from marshmallow import ValidationError
from werkzeug.security import check_password_hash, generate_password_hash

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


def test_current_user_put_schema_has_current_password_field() -> None:
    """The payload schema for ``PUT /api/v1/me/`` carries a field for proving
    knowledge of the existing password, required whenever ``password`` is
    supplied.
    """
    schema = CurrentUserPutSchema()

    assert "password" in schema.fields
    assert "current_password" in schema.fields

    with pytest.raises(ValidationError):
        schema.load({"password": "BrandNewPassw0rd!"})

    # Present alongside "password", it loads fine (the schema only checks
    # that it was *supplied*; whether it's actually correct is verified
    # against the database in ``CurrentUserRestApi.pre_update``).
    loaded = schema.load(
        {"password": "BrandNewPassw0rd!", "current_password": "OldPassw0rd!"}
    )
    assert loaded["current_password"] == "OldPassw0rd!"  # noqa: S105


def test_update_me_rejects_password_change_without_correct_current_password(
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    """A caller can no longer change the password by supplying only the new
    value: an account with an existing password must prove knowledge of it
    via ``current_password`` -- omitting the field, or getting it wrong, both
    reject the change and leave the stored password untouched. Supplying the
    correct current password lets the change through.
    """
    original_hash = generate_password_hash("OldPassw0rd!")
    admin_user.password = original_hash

    with pytest.raises(ValidationError):
        _run_update_me(admin_user, {"password": "BrandNewPassw0rd!"})
    assert admin_user.password == original_hash

    with pytest.raises(ValidationError):
        _run_update_me(
            admin_user,
            {
                "password": "BrandNewPassw0rd!",
                "current_password": "WrongPassw0rd!",
            },
        )
    assert admin_user.password == original_hash

    _run_update_me(
        admin_user,
        {"password": "BrandNewPassw0rd!", "current_password": "OldPassw0rd!"},
    )
    db.session.flush()

    assert admin_user.password != original_hash
    assert check_password_hash(admin_user.password, "BrandNewPassw0rd!")


def test_update_me_password_change_persists_a_hash_not_plaintext(
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    """``pre_update`` computes ``generate_password_hash(data["password"])`` and
    assigns it to the user, and ``UserDAO.update`` is then called with the
    *same* ``data`` dict as ``attributes``. ``BaseDAO.update`` blindly
    ``setattr``s every key in ``attributes``, so ``pre_update`` must remove
    the plaintext ``password`` key (and any ``current_password``) from that
    dict once it's done with them, or the plaintext would overwrite the hash
    that was just computed and reach the database instead of it.

    ``admin_user`` starts with no password set, so this exercises the
    first-password-set path, which requires no proof of a prior password.
    """
    new_password = "BrandNewPassw0rd!"  # noqa: S105

    _run_update_me(admin_user, {"password": new_password})
    db.session.flush()

    stored_password = admin_user.password

    # The stored value should be a password hash that verifies against the
    # new password -- not the plaintext value itself.
    assert stored_password != new_password
    assert check_password_hash(stored_password, new_password)


def test_update_me_falsy_password_does_not_blank_stored_hash(
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    """A falsy ``password`` (e.g. an empty string, which the schema's
    complexity validator lets through when password complexity validation is
    disabled) skips the hashing branch entirely -- ``pre_update`` must still
    drop the key from ``data`` so it never reaches ``UserDAO.update``'s
    ``setattr`` loop and blanks the account's stored hash.
    """
    original_hash = generate_password_hash("OldPassw0rd!")
    admin_user.password = original_hash

    _run_update_me(admin_user, {"password": "", "first_name": "Foo"})
    db.session.flush()

    assert admin_user.password == original_hash
    assert admin_user.first_name == "Foo"
