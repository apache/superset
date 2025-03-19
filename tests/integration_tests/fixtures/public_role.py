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
import pytest
from flask.ctx import AppContext

from superset.extensions import db, security_manager
from tests.integration_tests.test_app import app


@pytest.fixture()
def public_role_like_gamma(app_context: AppContext):
    app.config["PUBLIC_ROLE_LIKE"] = "Gamma"
    security_manager.sync_role_definitions()

    yield

    security_manager.get_public_role().permissions = []
    db.session.commit()


@pytest.fixture()
def public_role_like_test_role(app_context: AppContext):
    app.config["PUBLIC_ROLE_LIKE"] = "TestRole"
    security_manager.sync_role_definitions()

    yield

    security_manager.get_public_role().permissions = []
    db.session.commit()
