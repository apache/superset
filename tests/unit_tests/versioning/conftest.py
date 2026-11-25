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
"""Shared disposable database fixture for native version capture tests."""

from collections.abc import Iterator

import pytest
from flask_appbuilder import Model
from sqlalchemy.orm import Session

from superset.app import SupersetApp
from superset.extensions import db


@pytest.fixture
def capture_session(app: SupersetApp) -> Iterator[Session]:
    """Create only disposable in-memory tables; retain native listener wiring."""
    assert db.engine.url.get_backend_name() == "sqlite"
    assert not db.engine.url.database
    Model.metadata.create_all(db.engine)
    session: Session = db.session()
    yield session
    db.session.remove()
    Model.metadata.drop_all(db.engine)
