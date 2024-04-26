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
from flask_appbuilder.security.sqla.models import Role, User

from superset import db, security_manager
from tests.integration_tests.constants import GAMMA_SQLLAB_NO_DATA_USERNAME


@pytest.fixture()
def create_gamma_sqllab_no_data(app_context: AppContext):
    gamma_role = db.session.query(Role).filter(Role.name == "Gamma").one_or_none()
    sqllab_role = db.session.query(Role).filter(Role.name == "sql_lab").one_or_none()

    security_manager.add_user(
        GAMMA_SQLLAB_NO_DATA_USERNAME,
        "gamma_sqllab_no_data",
        "gamma_sqllab_no_data",
        "gamma_sqllab_no_data@apache.org",
        [gamma_role, sqllab_role],
        password="general",
    )

    yield
    user = (
        db.session.query(User)
        .filter(User.username == GAMMA_SQLLAB_NO_DATA_USERNAME)
        .one_or_none()
    )
    db.session.delete(user)
    db.session.commit()
