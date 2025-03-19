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
# pylint: disable=unused-argument, import-outside-toplevel, unused-import
from __future__ import annotations

import pickle
from datetime import datetime, timedelta
from typing import Generator, TYPE_CHECKING
from uuid import UUID

import pytest
from flask.ctx import AppContext
from flask_appbuilder.security.sqla.models import User

from superset.extensions import db
from superset.key_value.exceptions import (
    KeyValueCreateFailedError,
    KeyValueUpdateFailedError,
)
from superset.key_value.types import (
    JsonKeyValueCodec,
    KeyValueResource,
    PickleKeyValueCodec,
)
from superset.utils import json
from superset.utils.core import override_user
from tests.unit_tests.fixtures.common import admin_user, after_each  # noqa: F401

if TYPE_CHECKING:
    from superset.key_value.models import KeyValueEntry

ID_KEY = 123
UUID_KEY = UUID("3e7a2ab8-bcaf-49b0-a5df-dfb432f291cc")
RESOURCE = KeyValueResource.APP
JSON_VALUE = {"foo": "bar"}
PICKLE_VALUE = object()
JSON_CODEC = JsonKeyValueCodec()
PICKLE_CODEC = PickleKeyValueCodec()
NEW_VALUE = {"foo": "baz"}


@pytest.fixture
def key_value_entry() -> Generator[KeyValueEntry, None, None]:
    from superset.key_value.models import KeyValueEntry

    entry = KeyValueEntry(
        id=ID_KEY,
        uuid=UUID_KEY,
        resource=RESOURCE,
        value=JSON_CODEC.encode(JSON_VALUE),
    )
    db.session.add(entry)
    db.session.flush()
    yield entry


def test_create_id_entry(
    app_context: AppContext,
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    from superset.daos.key_value import KeyValueDAO
    from superset.key_value.models import KeyValueEntry

    with override_user(admin_user):
        created_entry = KeyValueDAO.create_entry(
            resource=RESOURCE,
            value=JSON_VALUE,
            codec=JSON_CODEC,
        )
        db.session.flush()
        found_entry = (
            db.session.query(KeyValueEntry).filter_by(id=created_entry.id).one()
        )
        assert json.loads(found_entry.value) == JSON_VALUE
        assert found_entry.created_by_fk == admin_user.id


def test_create_uuid_entry(
    app_context: AppContext,
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    from superset.daos.key_value import KeyValueDAO
    from superset.key_value.models import KeyValueEntry

    with override_user(admin_user):
        created_entry = KeyValueDAO.create_entry(
            resource=RESOURCE, value=JSON_VALUE, codec=JSON_CODEC
        )
        db.session.flush()

    found_entry = (
        db.session.query(KeyValueEntry).filter_by(uuid=created_entry.uuid).one()
    )
    assert json.loads(found_entry.value) == JSON_VALUE
    assert found_entry.created_by_fk == admin_user.id


def test_create_fail_json_entry(
    app_context: AppContext,
    after_each: None,  # noqa: F811
) -> None:
    from superset.daos.key_value import KeyValueDAO

    with pytest.raises(KeyValueCreateFailedError):
        KeyValueDAO.create_entry(
            resource=RESOURCE,
            value=PICKLE_VALUE,
            codec=JSON_CODEC,
        )


def test_create_pickle_entry(
    app_context: AppContext,
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    from superset.daos.key_value import KeyValueDAO
    from superset.key_value.models import KeyValueEntry

    with override_user(admin_user):
        created_entry = KeyValueDAO.create_entry(
            resource=RESOURCE,
            value=PICKLE_VALUE,
            codec=PICKLE_CODEC,
        )
        db.session.flush()
        found_entry = (
            db.session.query(KeyValueEntry).filter_by(id=created_entry.id).one()
        )
        assert type(pickle.loads(found_entry.value)) == type(PICKLE_VALUE)
        assert found_entry.created_by_fk == admin_user.id


def test_get_value(
    app_context: AppContext,
    key_value_entry: KeyValueEntry,
    after_each: None,  # noqa: F811
) -> None:
    from superset.daos.key_value import KeyValueDAO

    value = KeyValueDAO.get_value(
        resource=RESOURCE,
        key=key_value_entry.id,
        codec=JSON_CODEC,
    )
    assert value == JSON_VALUE


def test_get_id_entry(
    app_context: AppContext,
    key_value_entry: KeyValueEntry,
    after_each: None,  # noqa: F811
) -> None:
    from superset.daos.key_value import KeyValueDAO

    found_entry = KeyValueDAO.get_entry(resource=RESOURCE, key=key_value_entry.id)
    assert found_entry is not None
    assert found_entry.id == key_value_entry.id


def test_get_uuid_entry(
    app_context: AppContext,
    key_value_entry: KeyValueEntry,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    from superset.daos.key_value import KeyValueDAO

    found_entry = KeyValueDAO.get_entry(resource=RESOURCE, key=key_value_entry.uuid)
    assert found_entry is not None
    assert JSON_CODEC.decode(found_entry.value) == JSON_VALUE


def test_get_id_entry_missing(
    app_context: AppContext,
    after_each: None,  # noqa: F811
) -> None:
    from superset.daos.key_value import KeyValueDAO

    entry = KeyValueDAO.get_entry(resource=RESOURCE, key=456)
    assert entry is None


def test_get_expired_entry(
    app_context: AppContext,
    after_each: None,  # noqa: F811
) -> None:
    from superset.daos.key_value import KeyValueDAO

    created_entry = KeyValueDAO.create_entry(
        resource=RESOURCE,
        value=JSON_VALUE,
        codec=JSON_CODEC,
        key=ID_KEY,
        expires_on=datetime.now() - timedelta(days=1),
    )
    found_entry = KeyValueDAO.get_entry(resource=RESOURCE, key=created_entry.id)
    assert found_entry is not None
    assert found_entry.is_expired() is True


def test_get_future_expiring_entry(
    app_context: AppContext,
    after_each: None,  # noqa: F811
) -> None:
    from superset.daos.key_value import KeyValueDAO

    created_entry = KeyValueDAO.create_entry(
        resource=RESOURCE,
        value=JSON_VALUE,
        codec=JSON_CODEC,
        key=ID_KEY,
        expires_on=datetime.now() + timedelta(days=1),
    )
    found_entry = KeyValueDAO.get_entry(resource=RESOURCE, key=created_entry.id)
    assert found_entry is not None
    assert found_entry.is_expired() is False


def test_update_id_entry(
    app_context: AppContext,
    key_value_entry: KeyValueEntry,  # noqa: F811
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    from superset.daos.key_value import KeyValueDAO

    with override_user(admin_user):
        updated_entry = KeyValueDAO.update_entry(
            resource=RESOURCE,
            key=ID_KEY,
            value=NEW_VALUE,
            codec=JSON_CODEC,
        )
        db.session.flush()
        assert updated_entry is not None
        assert JSON_CODEC.decode(updated_entry.value) == NEW_VALUE
        assert updated_entry.id == ID_KEY
        assert updated_entry.uuid == UUID_KEY
        found_entry = KeyValueDAO.get_entry(resource=RESOURCE, key=ID_KEY)
        assert found_entry is not None
        assert JSON_CODEC.decode(found_entry.value) == NEW_VALUE
        assert found_entry.changed_by_fk == admin_user.id


def test_update_uuid_entry(
    app_context: AppContext,
    key_value_entry: KeyValueEntry,  # noqa: F811
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    from superset.daos.key_value import KeyValueDAO

    with override_user(admin_user):
        updated_entry = KeyValueDAO.update_entry(
            resource=RESOURCE,
            key=UUID_KEY,
            value=NEW_VALUE,
            codec=JSON_CODEC,
        )
    db.session.flush()
    assert updated_entry is not None
    assert JSON_CODEC.decode(updated_entry.value) == NEW_VALUE
    assert updated_entry.id == ID_KEY
    assert updated_entry.uuid == UUID_KEY
    found_entry = KeyValueDAO.get_entry(resource=RESOURCE, key=UUID_KEY)
    assert found_entry is not None
    assert JSON_CODEC.decode(found_entry.value) == NEW_VALUE
    assert found_entry.changed_by_fk == admin_user.id


def test_update_missing_entry(
    app_context: AppContext,
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    from superset.daos.key_value import KeyValueDAO

    with override_user(admin_user):
        with pytest.raises(KeyValueUpdateFailedError):
            KeyValueDAO.update_entry(
                resource=RESOURCE,
                key=456,
                value=NEW_VALUE,
                codec=JSON_CODEC,
            )


def test_upsert_id_entry(
    app_context: AppContext,
    key_value_entry: KeyValueEntry,  # noqa: F811
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    from superset.daos.key_value import KeyValueDAO

    with override_user(admin_user):
        entry = KeyValueDAO.upsert_entry(
            resource=RESOURCE,
            key=ID_KEY,
            value=NEW_VALUE,
            codec=JSON_CODEC,
        )
        found_entry = KeyValueDAO.get_entry(resource=RESOURCE, key=ID_KEY)
        assert found_entry is not None
        assert JSON_CODEC.decode(found_entry.value) == NEW_VALUE
        assert entry.changed_by_fk == admin_user.id


def test_upsert_uuid_entry(
    app_context: AppContext,
    key_value_entry: KeyValueEntry,  # noqa: F811
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    from superset.daos.key_value import KeyValueDAO

    with override_user(admin_user):
        entry = KeyValueDAO.upsert_entry(
            resource=RESOURCE,
            key=UUID_KEY,
            value=NEW_VALUE,
            codec=JSON_CODEC,
        )
        db.session.flush()
        assert entry is not None
        assert entry.id == ID_KEY
        assert entry.uuid == UUID_KEY
        found_entry = KeyValueDAO.get_entry(resource=RESOURCE, key=UUID_KEY)
        assert found_entry is not None
        assert JSON_CODEC.decode(found_entry.value) == NEW_VALUE
        assert entry.changed_by_fk == admin_user.id


def test_upsert_missing_entry(
    app_context: AppContext,
    after_each: None,  # noqa: F811
) -> None:
    from superset.daos.key_value import KeyValueDAO

    entry = KeyValueDAO.get_entry(resource=RESOURCE, key=ID_KEY)
    assert entry is None
    KeyValueDAO.upsert_entry(
        resource=RESOURCE,
        key=ID_KEY,
        value=NEW_VALUE,
        codec=JSON_CODEC,
    )
    entry = KeyValueDAO.get_entry(resource=RESOURCE, key=ID_KEY)
    assert entry is not None
    assert JSON_CODEC.decode(entry.value) == NEW_VALUE


def test_delete_id_entry(
    app_context: AppContext,
    key_value_entry: KeyValueEntry,
    after_each: None,  # noqa: F811
) -> None:
    from superset.daos.key_value import KeyValueDAO

    assert KeyValueDAO.delete_entry(resource=RESOURCE, key=ID_KEY) is True


def test_delete_uuid_entry(
    app_context: AppContext,
    key_value_entry: KeyValueEntry,
    after_each: None,  # noqa: F811
) -> None:
    from superset.daos.key_value import KeyValueDAO

    assert KeyValueDAO.delete_entry(resource=RESOURCE, key=UUID_KEY) is True


def test_delete_entry_missing(
    app_context: AppContext,
    after_each: None,  # noqa: F811
) -> None:
    from superset.daos.key_value import KeyValueDAO

    assert KeyValueDAO.delete_entry(resource=RESOURCE, key=12345678) is False
