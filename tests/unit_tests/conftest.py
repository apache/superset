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

from typing import Iterator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm.session import Session


@pytest.fixture()
def session() -> Iterator[Session]:
    """
    Create an in-memory SQLite session to test models.
    """
    engine = create_engine("sqlite:///:memory:")
    Session_ = sessionmaker(bind=engine)  # pylint: disable=invalid-name
    in_memory_session = Session_()

    # flask calls session.remove()
    in_memory_session.remove = lambda: None

    yield in_memory_session


@pytest.fixture
def app_context() -> Iterator[None]:
    """
    A fixture for running the test inside an app context.
    """
    from superset.app import create_app  # pylint: disable=import-outside-toplevel

    app = create_app()
    with app.app_context():
        yield
