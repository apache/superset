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
from collections.abc import Generator
from typing import TYPE_CHECKING
from uuid import UUID

import pytest
from flask_appbuilder.security.sqla.models import User
from sqlalchemy.orm import Session

from superset.extensions import db
from superset.key_value.types import (
    JsonKeyValueCodec,
    KeyValueResource,
    PickleKeyValueCodec,
)
from tests.integration_tests.test_app import app

if TYPE_CHECKING:
    from superset.key_value.models import KeyValueEntry

ID_KEY = 123
UUID_KEY = UUID("3e7a2ab8-bcaf-49b0-a5df-dfb432f291cc")
RESOURCE = KeyValueResource.APP
JSON_VALUE = {"foo": "bar"}
PICKLE_VALUE = object()
JSON_CODEC = JsonKeyValueCodec()
PICKLE_CODEC = PickleKeyValueCodec()


@pytest.fixture
def key_value_entry() -> Generator[KeyValueEntry, None, None]:
    from superset.key_value.models import KeyValueEntry

    entry = KeyValueEntry(
        id=ID_KEY,
        uuid=UUID_KEY,
        resource=RESOURCE,
        value=bytes(json.dumps(JSON_VALUE), encoding="utf-8"),
    )
    db.session.add(entry)
    db.session.commit()
    yield entry
    db.session.delete(entry)
    db.session.commit()


@pytest.fixture
def admin() -> User:
    with app.app_context() as ctx:
        admin = db.session.query(User).filter_by(username="admin").one()
        return admin
