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
# pylint: disable=redefined-outer-name, import-outside-toplevel

import importlib
import os
from typing import Any, Callable, Iterator

import pytest
from _pytest.fixtures import SubRequest
from pytest_mock import MockFixture
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.app import SupersetApp
from superset.extensions import appbuilder
from superset.initialization import SupersetAppInitializer


@pytest.fixture
def get_session(mocker: MockFixture) -> Callable[[], Session]:
    """
    Create an in-memory SQLite session to test models.
    """
    engine = create_engine("sqlite://")

    def get_session():
        Session_ = sessionmaker(bind=engine)  # pylint: disable=invalid-name
        in_memory_session = Session_()

        # flask calls session.remove()
        in_memory_session.remove = lambda: None

        # patch session
        get_session = mocker.patch(
            "superset.security.SupersetSecurityManager.get_session",
        )
        get_session.return_value = in_memory_session
        # FAB calls get_session.get_bind() to get a handler to the engine
        get_session.get_bind.return_value = engine
        # Allow for queries on security manager
        get_session.query = in_memory_session.query

        mocker.patch("superset.db.session", in_memory_session)
        return in_memory_session

    return get_session


@pytest.fixture
def session(get_session) -> Iterator[Session]:
    yield get_session()


@pytest.fixture(scope="module")
def app(request: SubRequest) -> Iterator[SupersetApp]:
    """
    A fixture that generates a Superset app.
    """
    app = SupersetApp(__name__)

    app.config.from_object("superset.config")
    app.config["SQLALCHEMY_DATABASE_URI"] = (
        os.environ.get("SUPERSET__SQLALCHEMY_DATABASE_URI") or "sqlite://"
    )
    app.config["WTF_CSRF_ENABLED"] = False
    app.config["PREVENT_UNSAFE_DB_CONNECTIONS"] = False
    app.config["TESTING"] = True

    # loop over extra configs passed in by tests
    if request and hasattr(request, "param"):
        for key, val in request.param.items():
            app.config[key] = val

    # ``superset.extensions.appbuilder`` is a singleton, and won't rebuild the
    # routes when this fixture is called multiple times; we need to clear the
    # registered views to ensure the initialization can happen more than once.
    appbuilder.baseviews = []

    app_initializer = SupersetAppInitializer(app)
    app_initializer.init_app()

    # reload base views to ensure error handlers are applied to the app
    with app.app_context():
        import superset.views.base

        importlib.reload(superset.views.base)

    yield app


@pytest.fixture
def client(app: SupersetApp) -> Any:
    with app.test_client() as client:
        yield client


@pytest.fixture(autouse=True)
def app_context(app: SupersetApp) -> Iterator[None]:
    """
    A fixture that yields and application context.
    """
    with app.app_context():
        yield


@pytest.fixture
def full_api_access(mocker: MockFixture) -> Iterator[None]:
    """
    Allow full access to the API.

    TODO (betodealmeida): we should replace this with user-fixtures, eg, ``admin`` or
    ``gamma``, so that we have granular access to the APIs.
    """
    mocker.patch(
        "flask_appbuilder.security.decorators.verify_jwt_in_request",
        return_value=True,
    )
    mocker.patch.object(security_manager, "has_access", return_value=True)
    mocker.patch.object(security_manager, "can_access_all_databases", return_value=True)

    yield
