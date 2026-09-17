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

from typing import TYPE_CHECKING
from unittest import mock

import pytest

from superset import db
from superset.daos.dashboard import EmbeddedDashboardDAO
from superset.models.dashboard import Dashboard
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)
from tests.integration_tests.fixtures.client import client  # noqa: F401

if TYPE_CHECKING:
    from typing import Any

    from flask.testing import FlaskClient


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
@mock.patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    EMBEDDED_SUPERSET=True,
)
def test_get_embedded_dashboard(client: FlaskClient[Any]):  # noqa: F811
    dash = db.session.query(Dashboard).filter_by(slug="births").first()
    embedded = EmbeddedDashboardDAO.upsert(dash, [])
    db.session.flush()
    uri = f"embedded/{embedded.uuid}"
    response = client.get(uri)
    assert response.status_code == 200


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
@mock.patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    EMBEDDED_SUPERSET=True,
)
def test_get_embedded_dashboard_referrer_not_allowed(client: FlaskClient[Any]):  # noqa: F811
    dash = db.session.query(Dashboard).filter_by(slug="births").first()
    embedded = EmbeddedDashboardDAO.upsert(dash, ["test.example.com"])
    db.session.flush()
    uri = f"embedded/{embedded.uuid}"
    response = client.get(uri)
    assert response.status_code == 403


@mock.patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    EMBEDDED_SUPERSET=True,
)
def test_get_embedded_dashboard_non_found(client: FlaskClient[Any]):  # noqa: F811
    uri = "embedded/bad-uuid"  # noqa: F541
    response = client.get(uri)
    assert response.status_code == 404
