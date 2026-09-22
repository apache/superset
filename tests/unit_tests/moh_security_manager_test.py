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
from types import SimpleNamespace

from flask import Flask, g

from superset.moh_security_manager import MoHSecurityManager


def test_level_one_dashboard_ids_supports_configured_csv() -> None:
    app = Flask(__name__)
    app.config["MOH_LEVEL_ONE_DASHBOARD_IDS"] = "8, 12"
    manager = object.__new__(MoHSecurityManager)

    with app.app_context():
        assert manager._level_one_dashboard_ids() == {8, 12}


def test_non_restricted_dashboard_is_accessible_without_org_unit() -> None:
    app = Flask(__name__)
    app.config["MOH_LEVEL_ONE_DASHBOARD_IDS"] = {8}
    manager = object.__new__(MoHSecurityManager)
    manager.is_admin = lambda: False

    with app.app_context():
        assert manager.can_access_moh_dashboard(SimpleNamespace(id=3))


def test_level_one_user_can_access_restricted_dashboard() -> None:
    app = Flask(__name__)
    app.config["MOH_LEVEL_ONE_DASHBOARD_IDS"] = {8}
    manager = object.__new__(MoHSecurityManager)
    manager.is_admin = lambda: False
    manager._user_has_level_one_org_unit = lambda username: username == "moh_user"

    with app.test_request_context("/"):
        g.user = SimpleNamespace(username="moh_user", is_anonymous=False)

        assert manager.can_access_moh_dashboard(SimpleNamespace(id=8))


def test_non_level_one_user_denied_restricted_dashboard() -> None:
    app = Flask(__name__)
    app.config["MOH_LEVEL_ONE_DASHBOARD_IDS"] = {8}
    manager = object.__new__(MoHSecurityManager)
    manager.is_admin = lambda: False
    manager._user_has_level_one_org_unit = lambda username: False

    with app.test_request_context("/"):
        g.user = SimpleNamespace(username="region_user", is_anonymous=False)

        assert not manager.can_access_moh_dashboard(SimpleNamespace(id=8))


def test_allowlisted_guest_username_can_access_restricted_dashboard() -> None:
    app = Flask(__name__)
    app.config["MOH_LEVEL_ONE_DASHBOARD_IDS"] = {8}
    app.config["MOH_LEVEL_ONE_GUEST_USERNAMES"] = {"tvp-guest"}
    manager = object.__new__(MoHSecurityManager)
    manager.is_admin = lambda: False
    # No org-unit row for a guest identity; the allowlist must be what grants access.
    manager._user_has_level_one_org_unit = lambda username: False

    with app.test_request_context("/"):
        g.user = SimpleNamespace(username="tvp-guest", is_anonymous=False)

        assert manager.can_access_moh_dashboard(SimpleNamespace(id=8))


def test_non_allowlisted_guest_username_denied_restricted_dashboard() -> None:
    app = Flask(__name__)
    app.config["MOH_LEVEL_ONE_DASHBOARD_IDS"] = {8}
    app.config["MOH_LEVEL_ONE_GUEST_USERNAMES"] = {"tvp-guest"}
    manager = object.__new__(MoHSecurityManager)
    manager.is_admin = lambda: False
    manager._user_has_level_one_org_unit = lambda username: False

    with app.test_request_context("/"):
        g.user = SimpleNamespace(username="some-other-guest", is_anonymous=False)

        assert not manager.can_access_moh_dashboard(SimpleNamespace(id=8))


def test_guest_allowlist_supports_configured_csv() -> None:
    app = Flask(__name__)
    app.config["MOH_LEVEL_ONE_GUEST_USERNAMES"] = "tvp-guest, other-guest"
    manager = object.__new__(MoHSecurityManager)

    with app.app_context():
        assert manager._level_one_guest_usernames() == {"tvp-guest", "other-guest"}


def test_guest_allowlist_empty_by_default() -> None:
    app = Flask(__name__)
    manager = object.__new__(MoHSecurityManager)

    with app.app_context():
        assert manager._level_one_guest_usernames() == set()


def test_raise_for_access_reads_dashboard_id_from_form_data() -> None:
    app = Flask(__name__)
    app.config["MOH_LEVEL_ONE_DASHBOARD_IDS"] = {8}
    manager = object.__new__(MoHSecurityManager)
    manager.is_admin = lambda: False
    manager._user_has_level_one_org_unit = lambda username: False

    from superset.exceptions import SupersetSecurityException
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType

    manager.get_dashboard_access_error_object = lambda dashboard: SupersetError(
        error_type=SupersetErrorType.DASHBOARD_SECURITY_ACCESS_ERROR,
        message="denied",
        level=ErrorLevel.WARNING,
    )

    class _QueryContext:
        form_data = {"dashboardId": 8}

    with app.test_request_context("/"):
        g.user = SimpleNamespace(username="region_user", is_anonymous=False)
        try:
            manager.raise_for_access(query_context=_QueryContext())
            raised = False
        except SupersetSecurityException:
            raised = True

        assert raised
