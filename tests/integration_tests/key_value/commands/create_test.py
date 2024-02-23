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

import json
import pickle

import pytest
from flask.ctx import AppContext
from flask_appbuilder.security.sqla.models import User

from superset.extensions import db
from superset.key_value.exceptions import KeyValueCreateFailedError
from superset.utils.core import override_user
from tests.integration_tests.key_value.commands.fixtures import (
    admin,
    JSON_CODEC,
    JSON_VALUE,
    PICKLE_CODEC,
    PICKLE_VALUE,
    RESOURCE,
)


def test_create_id_entry(app_context: AppContext, admin: User) -> None:
    from superset.commands.key_value.create import CreateKeyValueCommand
    from superset.key_value.models import KeyValueEntry

    with override_user(admin):
        key = CreateKeyValueCommand(
            resource=RESOURCE,
            value=JSON_VALUE,
            codec=JSON_CODEC,
        ).run()
        entry = db.session.query(KeyValueEntry).filter_by(id=key.id).one()
        assert json.loads(entry.value) == JSON_VALUE
        assert entry.created_by_fk == admin.id
        db.session.delete(entry)
        db.session.commit()


def test_create_uuid_entry(app_context: AppContext, admin: User) -> None:
    from superset.commands.key_value.create import CreateKeyValueCommand
    from superset.key_value.models import KeyValueEntry

    with override_user(admin):
        key = CreateKeyValueCommand(
            resource=RESOURCE, value=JSON_VALUE, codec=JSON_CODEC
        ).run()
    entry = db.session.query(KeyValueEntry).filter_by(uuid=key.uuid).one()
    assert json.loads(entry.value) == JSON_VALUE
    assert entry.created_by_fk == admin.id
    db.session.delete(entry)
    db.session.commit()


def test_create_fail_json_entry(app_context: AppContext, admin: User) -> None:
    from superset.commands.key_value.create import CreateKeyValueCommand

    with pytest.raises(KeyValueCreateFailedError):
        CreateKeyValueCommand(
            resource=RESOURCE,
            value=PICKLE_VALUE,
            codec=JSON_CODEC,
        ).run()


def test_create_pickle_entry(app_context: AppContext, admin: User) -> None:
    from superset.commands.key_value.create import CreateKeyValueCommand
    from superset.key_value.models import KeyValueEntry

    with override_user(admin):
        key = CreateKeyValueCommand(
            resource=RESOURCE,
            value=PICKLE_VALUE,
            codec=PICKLE_CODEC,
        ).run()
        entry = db.session.query(KeyValueEntry).filter_by(id=key.id).one()
        assert type(pickle.loads(entry.value)) == type(PICKLE_VALUE)
        assert entry.created_by_fk == admin.id
        db.session.delete(entry)
        db.session.commit()
