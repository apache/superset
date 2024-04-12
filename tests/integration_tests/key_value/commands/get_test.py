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
import uuid
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from flask.ctx import AppContext

from superset.extensions import db
from tests.integration_tests.key_value.commands.fixtures import (
    ID_KEY,
    JSON_CODEC,
    JSON_VALUE,
    key_value_entry,
    RESOURCE,
    UUID_KEY,
)

if TYPE_CHECKING:
    from superset.key_value.models import KeyValueEntry


def test_get_id_entry(app_context: AppContext, key_value_entry: KeyValueEntry) -> None:
    from superset.commands.key_value.get import GetKeyValueCommand

    value = GetKeyValueCommand(resource=RESOURCE, key=ID_KEY, codec=JSON_CODEC).run()
    assert value == JSON_VALUE


def test_get_uuid_entry(
    app_context: AppContext, key_value_entry: KeyValueEntry
) -> None:
    from superset.commands.key_value.get import GetKeyValueCommand

    value = GetKeyValueCommand(resource=RESOURCE, key=UUID_KEY, codec=JSON_CODEC).run()
    assert value == JSON_VALUE


def test_get_id_entry_missing(
    app_context: AppContext,
    key_value_entry: KeyValueEntry,
) -> None:
    from superset.commands.key_value.get import GetKeyValueCommand

    value = GetKeyValueCommand(resource=RESOURCE, key=456, codec=JSON_CODEC).run()
    assert value is None


def test_get_expired_entry(app_context: AppContext) -> None:
    from superset.commands.key_value.get import GetKeyValueCommand
    from superset.key_value.models import KeyValueEntry

    entry = KeyValueEntry(
        id=678,
        uuid=uuid.uuid4(),
        resource=RESOURCE,
        value=bytes(json.dumps(JSON_VALUE), encoding="utf-8"),
        expires_on=datetime.now() - timedelta(days=1),
    )
    db.session.add(entry)
    db.session.commit()
    value = GetKeyValueCommand(resource=RESOURCE, key=ID_KEY, codec=JSON_CODEC).run()
    assert value is None
    db.session.delete(entry)
    db.session.commit()


def test_get_future_expiring_entry(app_context: AppContext) -> None:
    from superset.commands.key_value.get import GetKeyValueCommand
    from superset.key_value.models import KeyValueEntry

    id_ = 789
    entry = KeyValueEntry(
        id=id_,
        uuid=uuid.uuid4(),
        resource=RESOURCE,
        value=bytes(json.dumps(JSON_VALUE), encoding="utf-8"),
        expires_on=datetime.now() + timedelta(days=1),
    )
    db.session.add(entry)
    db.session.commit()
    value = GetKeyValueCommand(resource=RESOURCE, key=id_, codec=JSON_CODEC).run()
    assert value == JSON_VALUE
    db.session.delete(entry)
    db.session.commit()
