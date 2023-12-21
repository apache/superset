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
from typing import TYPE_CHECKING
from uuid import UUID

import pytest
from flask.ctx import AppContext
from flask_appbuilder.security.sqla.models import User

from superset.extensions import db
from tests.integration_tests.key_value.commands.fixtures import (
    admin,
    JSON_VALUE,
    RESOURCE,
)

if TYPE_CHECKING:
    from superset.key_value.models import KeyValueEntry

ID_KEY = 234
UUID_KEY = UUID("5aae143c-44f1-478e-9153-ae6154df333a")


@pytest.fixture
def key_value_entry() -> KeyValueEntry:
    from superset.key_value.models import KeyValueEntry

    entry = KeyValueEntry(
        id=ID_KEY,
        uuid=UUID_KEY,
        resource=RESOURCE,
        value=bytes(json.dumps(JSON_VALUE), encoding="utf-8"),
    )
    db.session.add(entry)
    db.session.commit()
    return entry


def test_delete_id_entry(
    app_context: AppContext,
    admin: User,
    key_value_entry: KeyValueEntry,
) -> None:
    from superset.commands.key_value.delete import DeleteKeyValueCommand

    assert DeleteKeyValueCommand(resource=RESOURCE, key=ID_KEY).run() is True


def test_delete_uuid_entry(
    app_context: AppContext,
    admin: User,
    key_value_entry: KeyValueEntry,
) -> None:
    from superset.commands.key_value.delete import DeleteKeyValueCommand

    assert DeleteKeyValueCommand(resource=RESOURCE, key=UUID_KEY).run() is True


def test_delete_entry_missing(
    app_context: AppContext,
    admin: User,
    key_value_entry: KeyValueEntry,
) -> None:
    from superset.commands.key_value.delete import DeleteKeyValueCommand

    assert DeleteKeyValueCommand(resource=RESOURCE, key=456).run() is False
