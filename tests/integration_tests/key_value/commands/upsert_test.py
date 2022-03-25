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

import pickle
from typing import TYPE_CHECKING
from uuid import UUID

from flask.ctx import AppContext
from flask_appbuilder.security.sqla.models import User

from superset.extensions import db
from tests.integration_tests.key_value.commands.fixtures import (
    admin,
    ID_KEY,
    key_value_entry,
    RESOURCE,
    UUID_KEY,
)

if TYPE_CHECKING:
    from superset.key_value.models import KeyValueEntry


NEW_VALUE = "new value"


def test_upsert_id_entry(
    app_context: AppContext, admin: User, key_value_entry: KeyValueEntry,
) -> None:
    from superset.key_value.commands.upsert import UpsertKeyValueCommand
    from superset.key_value.models import KeyValueEntry

    key = UpsertKeyValueCommand(
        actor=admin, resource=RESOURCE, key=ID_KEY, value=NEW_VALUE,
    ).run()
    assert key.id == ID_KEY
    entry = (
        db.session.query(KeyValueEntry).filter_by(id=int(ID_KEY)).autoflush(False).one()
    )
    assert pickle.loads(entry.value) == NEW_VALUE
    assert entry.changed_by_fk == admin.id


def test_upsert_uuid_entry(
    app_context: AppContext, admin: User, key_value_entry: KeyValueEntry,
) -> None:
    from superset.key_value.commands.upsert import UpsertKeyValueCommand
    from superset.key_value.models import KeyValueEntry

    key = UpsertKeyValueCommand(
        actor=admin, resource=RESOURCE, key=UUID_KEY, value=NEW_VALUE,
    ).run()
    assert key.uuid == UUID_KEY
    entry = (
        db.session.query(KeyValueEntry).filter_by(uuid=UUID_KEY).autoflush(False).one()
    )
    assert pickle.loads(entry.value) == NEW_VALUE
    assert entry.changed_by_fk == admin.id


def test_upsert_missing_entry(app_context: AppContext, admin: User) -> None:
    from superset.key_value.commands.upsert import UpsertKeyValueCommand
    from superset.key_value.models import KeyValueEntry

    key = UpsertKeyValueCommand(
        actor=admin, resource=RESOURCE, key=456, value=NEW_VALUE,
    ).run()
    assert key.id == 456
    db.session.query(KeyValueEntry).filter_by(id=456).delete()
    db.session.commit()
