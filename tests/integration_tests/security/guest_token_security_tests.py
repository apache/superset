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
"""Unit tests for Superset"""

from unittest.mock import Mock, patch

import pytest
from flask import g

from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.daos.dashboard import EmbeddedDashboardDAO
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.security.guest_token import GuestTokenResourceType  # noqa: F401
from superset.sql_parse import Table  # noqa: F401
from superset.utils import json
from superset.utils.core import get_example_default_schema
from superset.utils.database import get_example_database
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices_class_scope,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,  # noqa: F401
    load_world_bank_dashboard_with_slices_class_scope,  # noqa: F401
    load_world_bank_data,  # noqa: F401
)


@patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    EMBEDDED_SUPERSET=True,
)
class TestGuestUserSecurity(SupersetTestCase):
    def authorized_guest(self):
        return security_manager.get_guest_user_from_token(
            {"user": {}, "resources": [{"type": "dashboard", "id": "some-uuid"}]}
        )

    def test_is_guest_user__regular_user(self):
        is_guest = security_manager.is_guest_user(security_manager.find_user("admin"))
        assert not is_guest

    def test_is_guest_user__anonymous(self):
        is_guest = security_manager.is_guest_user(security_manager.get_anonymous_user())
        assert not is_guest

    def test_is_guest_user__guest_user(self):
        is_guest = security_manager.is_guest_user(self.authorized_guest())
        assert is_guest

    @patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        EMBEDDED_SUPERSET=False,
    )
    def test_is_guest_user__flag_off(self):
        is_guest = security_manager.is_guest_user(self.authorized_guest())
        assert not is_guest

    def test_get_guest_user__regular_user(self):
        g.user = security_manager.find_user("admin")
        guest_user = security_manager.get_current_guest_user_if_guest()
        assert guest_user is None

    def test_get_guest_user__anonymous_user(self):
        g.user = security_manager.get_anonymous_user()
        guest_user = security_manager.get_current_guest_user_if_guest()
        assert guest_user is None

    def test_get_guest_user__guest_user(self):
        g.user = self.authorized_guest()
        guest_user = security_manager.get_current_guest_user_if_guest()
        assert guest_user == g.user

    def test_get_guest_user_roles_explicit(self):
        guest = self.authorized_guest()
        roles = security_manager.get_user_roles(guest)
        assert guest.roles == roles

    def test_get_guest_user_roles_implicit(self):
        guest = self.authorized_guest()
        g.user = guest

        roles = security_manager.get_user_roles()
        assert guest.roles == roles


@patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    EMBEDDED_SUPERSET=True,
)
@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices_class_scope")
class TestGuestUserDashboardAccess(SupersetTestCase):
    def setUp(self) -> None:
        self.dash = self.get_dash_by_slug("births")
        self.embedded = EmbeddedDashboardDAO.upsert(self.dash, [])
        self.authorized_guest = security_manager.get_guest_user_from_token(
            {
                "user": {},
                "resources": [
                    {
                        "type": GuestTokenResourceType.DASHBOARD,
                        "id": str(self.embedded.uuid),
                    }
                ],
                "iat": 10,
                "exp": 20,
                "rls_rules": [],
            }
        )
        self.unauthorized_guest = security_manager.get_guest_user_from_token(
            {
                "user": {},
                "resources": [
                    {
                        "type": GuestTokenResourceType.DASHBOARD,
                        "id": "06383667-3e02-4e5e-843f-44e9c5896b6c",
                    }
                ],
                "iat": 10,
                "exp": 20,
                "rls_rules": [],
            }
        )

    def test_has_guest_access__regular_user(self):
        g.user = security_manager.find_user("admin")
        has_guest_access = security_manager.has_guest_access(self.dash)
        assert not has_guest_access

    def test_has_guest_access__anonymous_user(self):
        g.user = security_manager.get_anonymous_user()
        has_guest_access = security_manager.has_guest_access(self.dash)
        assert not has_guest_access

    def test_has_guest_access__authorized_guest_user(self):
        g.user = self.authorized_guest
        has_guest_access = security_manager.has_guest_access(self.dash)
        assert has_guest_access

    def test_has_guest_access__authorized_guest_user__non_zero_resource_index(self):
        # set up a user who has authorized access, plus another resource
        guest = self.authorized_guest
        guest.resources = [
            {"type": "dashboard", "id": "not-a-real-id"}
        ] + guest.resources
        g.user = guest

        has_guest_access = security_manager.has_guest_access(self.dash)
        assert has_guest_access

    def test_has_guest_access__unauthorized_guest_user__different_resource_id(self):
        g.user = security_manager.get_guest_user_from_token(
            {
                "user": {},
                "resources": [{"type": "dashboard", "id": "not-a-real-id"}],
            }
        )
        has_guest_access = security_manager.has_guest_access(self.dash)
        assert not has_guest_access

    def test_has_guest_access__unauthorized_guest_user__different_resource_type(self):
        g.user = security_manager.get_guest_user_from_token(
            {"user": {}, "resources": [{"type": "dirt", "id": self.embedded.uuid}]}
        )
        has_guest_access = security_manager.has_guest_access(self.dash)
        assert not has_guest_access

    def test_raise_for_dashboard_access_as_guest(self):
        g.user = self.authorized_guest

        security_manager.raise_for_access(dashboard=self.dash)

    def test_raise_for_access_dashboard_as_unauthorized_guest(self):
        g.user = self.unauthorized_guest

        with self.assertRaises(SupersetSecurityException):
            security_manager.raise_for_access(dashboard=self.dash)

    def test_raise_for_access_dashboard_as_guest_no_rbac(self):
        """
        Test that guest account has no access to other dashboards.

        A bug in the ``raise_for_access`` logic allowed the guest user to
        fetch data from other dashboards, as long as the other dashboard:

          - was not embedded AND
            - was not published OR
            - had at least 1 datasource that the user had access to.

        """
        g.user = self.unauthorized_guest

        # Create a draft dashboard that is not embedded
        dash = Dashboard()
        dash.dashboard_title = "My Dashboard"
        dash.published = False
        db.session.add(dash)
        db.session.commit()

        with self.assertRaises(SupersetSecurityException):
            security_manager.raise_for_access(dashboard=dash)

        db.session.delete(dash)
        db.session.commit()


@patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    EMBEDDED_SUPERSET=True,
)
@pytest.mark.usefixtures(
    "create_dataset",
    "load_birth_names_dashboard_with_slices_class_scope",
    "load_world_bank_dashboard_with_slices_class_scope",
)
class TestGuestUserDatasourceAccess(SupersetTestCase):
    """
    Guest users should only have access to datasources that are associated with a
    dashboard they have access to, and only with that dashboard context present
    """

    @pytest.fixture(scope="class")
    def create_dataset(self):
        with self.create_app().app_context():
            dataset = SqlaTable(
                table_name="dummy_sql_table",
                database=get_example_database(),
                schema=get_example_default_schema(),
                sql="select 123 as intcol, 'abc' as strcol",
            )
            db.session.add(dataset)
            db.session.commit()

            yield dataset

            # rollback
            db.session.delete(dataset)
            db.session.commit()

    def setUp(self) -> None:
        self.dash = self.get_dash_by_slug("births")
        self.other_dash = self.get_dash_by_slug("world_health")
        self.embedded = EmbeddedDashboardDAO.upsert(self.dash, [])
        self.authorized_guest = security_manager.get_guest_user_from_token(
            {
                "user": {},
                "resources": [
                    {
                        "type": GuestTokenResourceType.DASHBOARD,
                        "id": str(self.embedded.uuid),
                    }
                ],
                "iat": 10,
                "exp": 20,
                "rls_rules": [],
            }
        )
        self.unauthorized_guest = security_manager.get_guest_user_from_token(
            {
                "user": {},
                "resources": [
                    {
                        "type": GuestTokenResourceType.DASHBOARD,
                        "id": "06383667-3e02-4e5e-843f-44e9c5896b6c",
                    }
                ],
                "iat": 10,
                "exp": 20,
                "rls_rules": [],
            }
        )
        self.chart = self.get_slice("Girls")
        self.datasource = self.chart.datasource
        self.other_chart = self.get_slice("Treemap")
        self.other_datasource = self.other_chart.datasource
        self.native_filter_datasource = (
            db.session.query(SqlaTable).filter_by(table_name="dummy_sql_table").first()
        )
        self.dash.json_metadata = json.dumps(
            {
                "native_filter_configuration": [
                    {
                        "id": "NATIVE_FILTER-ABCDEFGH",
                        "targets": [{"datasetId": self.native_filter_datasource.id}],
                    },
                ]
            }
        )

    def test_raise_for_access__happy_path(self):
        g.user = self.authorized_guest
        for kwarg in ["viz", "query_context"]:
            security_manager.raise_for_access(
                **{
                    kwarg: Mock(
                        datasource=self.datasource,
                        form_data={
                            "dashboardId": self.dash.id,
                            "slice_id": self.chart.id,
                            "metrics": self.chart.params_dict["metrics"],
                        },
                        slice_=self.chart,
                        queries=[],
                    )
                }
            )

    def test_raise_for_access__native_filter_happy_path(self):
        g.user = self.authorized_guest
        for kwarg in ["viz", "query_context"]:
            security_manager.raise_for_access(
                **{
                    kwarg: Mock(
                        datasource=self.native_filter_datasource,
                        form_data={
                            "dashboardId": self.dash.id,
                            "native_filter_id": "NATIVE_FILTER-ABCDEFGH",
                            "type": "NATIVE_FILTER",
                            "slice_id": self.chart.id,
                            "metrics": self.chart.params_dict["metrics"],
                        },
                        slice_=self.chart,
                        queries=[],
                    )
                }
            )

    def test_raise_for_access__no_dashboard_in_form_data(self):
        g.user = self.authorized_guest
        for kwarg in ["viz", "query_context"]:
            with self.assertRaises(SupersetSecurityException):
                security_manager.raise_for_access(
                    **{
                        kwarg: Mock(
                            datasource=self.datasource,
                            form_data={
                                "slice_id": self.chart.id,
                            },
                        )
                    }
                )

    def test_raise_for_access__no_chart_in_form_data(self):
        g.user = self.authorized_guest
        for kwarg in ["viz", "query_context"]:
            with self.assertRaises(SupersetSecurityException):
                security_manager.raise_for_access(
                    **{
                        kwarg: Mock(
                            datasource=self.datasource,
                            form_data={
                                "dashboardId": self.dash.id,
                            },
                        )
                    }
                )

    def test_raise_for_access__chart_not_on_dashboard(self):
        g.user = self.authorized_guest
        for kwarg in ["viz", "query_context"]:
            with self.assertRaises(SupersetSecurityException):
                security_manager.raise_for_access(
                    **{
                        kwarg: Mock(
                            datasource=self.other_datasource,
                            form_data={
                                "dashboardId": self.dash.id,
                                "slice_id": self.other_chart.id,
                            },
                        )
                    }
                )

    def test_raise_for_access__chart_doesnt_belong_to_datasource(self):
        g.user = self.authorized_guest
        for kwarg in ["viz", "query_context"]:
            with self.assertRaises(SupersetSecurityException):
                security_manager.raise_for_access(
                    **{
                        kwarg: Mock(
                            datasource=self.other_datasource,
                            form_data={
                                "dashboardId": self.dash.id,
                                "slice_id": self.chart.id,
                            },
                        )
                    }
                )

    def test_raise_for_access__native_filter_no_id_in_form_data(self):
        g.user = self.authorized_guest
        for kwarg in ["viz", "query_context"]:
            with self.assertRaises(SupersetSecurityException):
                security_manager.raise_for_access(
                    **{
                        kwarg: Mock(
                            datasource=self.native_filter_datasource,
                            form_data={
                                "dashboardId": self.dash.id,
                                "type": "NATIVE_FILTER",
                                "slice_id": self.chart.id,
                                "metrics": self.chart.params_dict["metrics"],
                            },
                            slice_=self.chart,
                            queries=[],
                        )
                    }
                )

    def test_raise_for_access__native_filter_datasource_not_associated(self):
        g.user = self.authorized_guest
        for kwarg in ["viz", "query_context"]:
            with self.assertRaises(SupersetSecurityException):
                security_manager.raise_for_access(
                    **{
                        kwarg: Mock(
                            datasource=self.other_datasource,
                            form_data={
                                "dashboardId": self.dash.id,
                                "native_filter_id": "NATIVE_FILTER-ABCDEFGH",
                                "type": "NATIVE_FILTER",
                                "slice_id": self.chart.id,
                                "metrics": self.chart.params_dict["metrics"],
                            },
                            slice_=self.chart,
                            queries=[],
                        )
                    }
                )

    @patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        EMBEDDED_SUPERSET=False,
    )
    def test_raise_for_access__embedded_feature_flag_off(self):
        g.user = self.authorized_guest
        for kwarg in ["viz", "query_context"]:
            with self.assertRaises(SupersetSecurityException):
                security_manager.raise_for_access(
                    **{
                        kwarg: Mock(
                            datasource=self.datasource,
                            form_data={
                                "dashboardId": self.dash.id,
                                "slice_id": self.chart.id,
                            },
                        )
                    }
                )

    def test_raise_for_access__unauthorized_guest_user(self):
        g.user = self.unauthorized_guest
        for kwarg in ["viz", "query_context"]:
            with self.assertRaises(SupersetSecurityException):
                security_manager.raise_for_access(
                    **{
                        kwarg: Mock(
                            datasource=self.datasource,
                            form_data={
                                "dashboardId": self.dash.id,
                                "slice_id": self.chart.id,
                            },
                        )
                    }
                )
