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
from typing import Generator, TYPE_CHECKING
from uuid import UUID

import pytest
from flask_appbuilder.security.sqla.models import User
from sqlalchemy.orm import Session

from superset.extensions import db
from tests.integration_tests.test_app import app

if TYPE_CHECKING:
    from superset.key_value.models import KeyValueEntry

ID_KEY = "123"
UUID_KEY = "3e7a2ab8-bcaf-49b0-a5df-dfb432f291cc"
RESOURCE = "my_resource"
VALUE = {"foo": "bar"}


@pytest.fixture
def key_value_entry() -> Generator[KeyValueEntry, None, None]:
    from superset.key_value.models import KeyValueEntry

    entry = KeyValueEntry(
        id=int(ID_KEY),
        uuid=UUID(UUID_KEY),
        resource=RESOURCE,
        value=pickle.dumps(VALUE),
    )
    db.session.add(entry)
    db.session.commit()
    yield entry
    db.session.delete(entry)
    db.session.commit()


@pytest.fixture
def admin() -> User:
    with app.app_context() as ctx:
        session: Session = ctx.app.appbuilder.get_session
        admin = session.query(User).filter_by(username="admin").one()
        return admin
