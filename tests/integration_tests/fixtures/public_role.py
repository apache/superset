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
from collections.abc import Iterator
from contextlib import contextmanager

import pytest
from flask.ctx import AppContext
from flask_appbuilder.security.sqla.models import PermissionView

from superset.extensions import db, security_manager
from tests.integration_tests.test_app import app


@contextmanager
def _public_role_like(role_name: str) -> Iterator[None]:
    """Temporarily sync Public to a role and restore its exact prior state."""
    original_value = app.config["PUBLIC_ROLE_LIKE"]
    original_permission_ids = [
        permission.id for permission in security_manager.get_public_role().permissions
    ]
    try:
        app.config["PUBLIC_ROLE_LIKE"] = role_name
        security_manager.sync_role_definitions()
        yield
    finally:
        app.config["PUBLIC_ROLE_LIKE"] = original_value
        # Tests and role syncing can commit or replace the session's ORM objects.
        security_manager.get_public_role().permissions = (
            db.session.query(PermissionView)
            .filter(PermissionView.id.in_(original_permission_ids))
            .all()
        )
        db.session.commit()


@pytest.fixture
def public_role_like_gamma(app_context: AppContext) -> Iterator[None]:
    """Temporarily give Public the Gamma role's permissions."""
    with _public_role_like("Gamma"):
        yield


@pytest.fixture
def public_role_like_test_role(app_context: AppContext) -> Iterator[None]:
    """Temporarily give Public the configured TestRole permissions."""
    with _public_role_like("TestRole"):
        yield


@pytest.fixture
def public_role_builtin(app_context: AppContext) -> Iterator[None]:
    """Temporarily give Public its built-in minimal read-only permissions."""
    with _public_role_like("Public"):
        yield
