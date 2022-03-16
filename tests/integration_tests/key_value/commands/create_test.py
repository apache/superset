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
from uuid import UUID

from flask.ctx import AppContext
from flask_appbuilder.security.sqla.models import User

from superset.extensions import db
from tests.integration_tests.key_value.commands.fixtures import (
    admin,
    ID_KEY,
    RESOURCE,
    UUID_KEY,
    VALUE,
)


def test_create_id_entry(app_context: AppContext, admin: User) -> None:
    from superset.key_value.commands.create import CreateKeyValueCommand
    from superset.key_value.models import KeyValueEntry

    key = CreateKeyValueCommand(
        actor=admin, resource=RESOURCE, value=VALUE, key_type="id",
    ).run()
    entry = (
        db.session.query(KeyValueEntry).filter_by(id=int(key)).autoflush(False).one()
    )
    assert pickle.loads(entry.value) == VALUE
    assert entry.created_by_fk == admin.id
    db.session.delete(entry)
    db.session.commit()


def test_create_uuid_entry(app_context: AppContext, admin: User) -> None:
    from superset.key_value.commands.create import CreateKeyValueCommand
    from superset.key_value.models import KeyValueEntry

    key = CreateKeyValueCommand(
        actor=admin, resource=RESOURCE, value=VALUE, key_type="uuid",
    ).run()
    entry = (
        db.session.query(KeyValueEntry).filter_by(uuid=UUID(key)).autoflush(False).one()
    )
    assert pickle.loads(entry.value) == VALUE
    assert entry.created_by_fk == admin.id
    db.session.delete(entry)
    db.session.commit()
