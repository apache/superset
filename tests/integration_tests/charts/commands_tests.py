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
import time
from copy import deepcopy
from datetime import datetime
from unittest.mock import patch
from uuid import uuid4

import pytest
import yaml
from flask import g  # noqa: F401

from superset import db, security_manager
from superset.commands.annotation_layer.exceptions import AnnotationLayerNotFoundError
from superset.commands.chart.create import CreateChartCommand
from superset.commands.chart.exceptions import (
    ChartForbiddenError,
    ChartNotFoundError,
    WarmUpCacheChartNotFoundError,
)
from superset.commands.chart.export import ExportChartsCommand
from superset.commands.chart.fave import AddFavoriteChartCommand
from superset.commands.chart.importers.v1 import ImportChartsCommand
from superset.commands.chart.unfave import DelFavoriteChartCommand
from superset.commands.chart.update import UpdateChartCommand
from superset.commands.chart.warm_up_cache import ChartWarmUpCacheCommand
from superset.commands.exceptions import CommandInvalidError
from superset.commands.importers.exceptions import IncorrectVersionError
from superset.connectors.sqla.models import SqlaTable
from superset.daos.chart import ChartDAO
from superset.models.annotations import Annotation, AnnotationLayer
from superset.models.core import Database
from superset.models.slice import Slice
from superset.utils import json
from superset.utils.core import override_user
from tests.integration_tests.base_tests import (
    subjects_from_users,
    SupersetTestCase,
    user_is_editor,
)
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)
from tests.integration_tests.fixtures.energy_dashboard import (
    load_energy_table_data,  # noqa: F401
    load_energy_table_with_slice,  # noqa: F401
)
from tests.integration_tests.fixtures.importexport import (
    chart_config,
    chart_metadata_config,
    database_config,
    database_metadata_config,
    dataset_config,
)


class TestExportChartsCommand(SupersetTestCase):
    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_export_chart_command(self, mock_g):
        mock_g.user = security_manager.find_user("admin")

        example_chart = (
            db.session.query(Slice).filter_by(slice_name="Energy Sankey").one()
        )
        command = ExportChartsCommand([example_chart.id])
        contents = dict(command.run())

        expected = [
            "metadata.yaml",
            f"charts/Energy_Sankey_{example_chart.id}.yaml",
            f"datasets/examples/energy_usage_{example_chart.table.id}.yaml",
            "databases/examples.yaml",
        ]
        assert expected == list(contents.keys())

        metadata = yaml.safe_load(
            contents[f"charts/Energy_Sankey_{example_chart.id}.yaml"]()
        )

        assert metadata == {
            "slice_name": "Energy Sankey",
            "description": None,
            "certified_by": None,
            "certification_details": None,
            "viz_type": "sankey",
            "params": {
                "collapsed_fieldsets": "",
                "groupby": ["source", "target"],
                "metric": "sum__value",
                "row_limit": "5000",
                "slice_name": "Energy Sankey",
                "viz_type": "sankey",
            },
            "cache_timeout": None,
            "dataset_uuid": str(example_chart.table.uuid),
            "uuid": str(example_chart.uuid),
            "version": "1.0.0",
            "query_context": None,
        }

    @patch("superset.utils.core.g")
    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_export_chart_command_no_access(self, utils_mock_g, manager_mock_g):
        """Test that users can't export datasets they don't have access to"""
        manager_mock_g.user = security_manager.find_user("gamma")
        utils_mock_g.user = manager_mock_g.user

        example_chart = db.session.query(Slice).all()[0]
        command = ExportChartsCommand([example_chart.id])
        contents = command.run()
        with self.assertRaises(ChartNotFoundError):  # noqa: PT027
            next(contents)

    @patch("superset.security.manager.g")
    def test_export_chart_command_invalid_dataset(self, mock_g):
        """Test that an error is raised when exporting an invalid dataset"""
        mock_g.user = security_manager.find_user("admin")
        command = ExportChartsCommand([-1])
        contents = command.run()
        with self.assertRaises(ChartNotFoundError):  # noqa: PT027
            next(contents)

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_export_chart_command_key_order(self, mock_g):
        """Test that they keys in the YAML have the same order as export_fields"""
        mock_g.user = security_manager.find_user("admin")

        example_chart = (
            db.session.query(Slice).filter_by(slice_name="Energy Sankey").one()
        )
        command = ExportChartsCommand([example_chart.id])
        contents = dict(command.run())

        metadata = yaml.safe_load(
            contents[f"charts/Energy_Sankey_{example_chart.id}.yaml"]()
        )
        assert list(metadata.keys()) == [
            "slice_name",
            "description",
            "certified_by",
            "certification_details",
            "viz_type",
            "params",
            "query_context",
            "cache_timeout",
            "uuid",
            "version",
            "dataset_uuid",
        ]

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_export_chart_command_no_related(self, mock_g):
        """
        Test that only the chart is exported when export_related=False.
        """
        mock_g.user = security_manager.find_user("admin")

        example_chart = (
            db.session.query(Slice).filter_by(slice_name="Energy Sankey").one()
        )
        command = ExportChartsCommand([example_chart.id], export_related=False)
        contents = dict(command.run())

        expected = [
            "metadata.yaml",
            f"charts/Energy_Sankey_{example_chart.id}.yaml",
        ]
        assert expected == list(contents.keys())

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_export_chart_command_unicode_chars(self, mock_g):
        """Test that unicode characters in a chart name are exported to the YAML"""
        mock_g.user = security_manager.find_user("admin")
        db.session.query(Slice).filter_by(slice_name="Energy Sankey").update(
            {"slice_name": "中文"},
        )
        try:
            example_chart = db.session.query(Slice).filter_by(slice_name="中文").one()

            command = ExportChartsCommand([example_chart.id])
            contents = dict(command.run())

            path = f"charts/{example_chart.id}.yaml"
            assert path in set(contents.keys())
            yaml_content = contents[path]()
            metadata = yaml.safe_load(yaml_content)
            assert metadata["slice_name"] == "中文"
            assert "slice_name: 中文" in yaml_content
        finally:
            # restore the original name so fixture teardown works even if an
            # assertion above fails
            db.session.query(Slice).filter_by(slice_name="中文").update(
                {"slice_name": "Energy Sankey"},
            )


class TestImportChartsCommand(SupersetTestCase):
    @patch("superset.utils.core.g")
    @patch("superset.security.manager.g")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_v1_chart(self, mock_add_permissions, sm_g, utils_g) -> None:
        """Test that we can import a chart"""
        admin = sm_g.user = utils_g.user = security_manager.find_user("admin")
        contents = {
            "metadata.yaml": yaml.safe_dump(chart_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
            "charts/imported_chart.yaml": yaml.safe_dump(chart_config),
        }
        command = ImportChartsCommand(contents)
        command.run()

        chart: Slice = (
            db.session.query(Slice).filter_by(uuid=chart_config["uuid"]).one()
        )
        dataset = chart.datasource
        assert json.loads(chart.params) == {
            "annotation_layers": [],
            "color_picker": {"a": 1, "b": 135, "g": 122, "r": 0},
            "datasource": dataset.uid if dataset else None,
            "line_column": "path_json",
            "line_type": "json",
            "line_width": 150,
            "mapbox_style": "mapbox://styles/mapbox/light-v9",
            "reverse_long_lat": False,
            "row_limit": 5000,
            "slice_id": 43,
            "time_grain_sqla": None,
            "time_range": " : ",
            "viewport": {
                "altitude": 1.5,
                "bearing": 0,
                "height": 1094,
                "latitude": 37.73671752604488,
                "longitude": -122.18885402582598,
                "maxLatitude": 85.05113,
                "maxPitch": 60,
                "maxZoom": 20,
                "minLatitude": -85.05113,
                "minPitch": 0,
                "minZoom": 0,
                "pitch": 0,
                "width": 669,
                "zoom": 9.51847667620428,
            },
            "viz_type": "deck_path",
        }

        dataset = (
            db.session.query(SqlaTable).filter_by(uuid=dataset_config["uuid"]).one()
        )
        table_name = dataset.table_name if dataset else None
        assert table_name == "imported_dataset"
        assert chart.table == dataset

        database = (
            db.session.query(Database).filter_by(uuid=database_config["uuid"]).one()
        )
        assert database.database_name == "imported_database"
        assert chart.table.database == database

        assert len(chart.editors) == 1
        assert user_is_editor(admin, chart)

        db.session.delete(chart)
        db.session.delete(dataset)
        db.session.delete(database)
        db.session.commit()

    @patch("superset.security.manager.g")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_v1_chart_multiple(self, mock_add_permissions, sm_g):
        """Test that a chart can be imported multiple times"""
        sm_g.user = security_manager.find_user("admin")
        contents = {
            "metadata.yaml": yaml.safe_dump(chart_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
            "charts/imported_chart.yaml": yaml.safe_dump(chart_config),
        }
        command = ImportChartsCommand(contents, overwrite=True)
        command.run()
        command.run()

        dataset = (
            db.session.query(SqlaTable).filter_by(uuid=dataset_config["uuid"]).one()
        )
        charts = db.session.query(Slice).filter_by(datasource_id=dataset.id).all()
        assert len(charts) == 1

        database = dataset.database

        db.session.delete(charts[0])
        db.session.delete(dataset)
        db.session.delete(database)
        db.session.commit()

    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_v1_chart_validation(self, mock_add_permissions):
        """Test different validations applied when importing a chart"""
        # metadata.yaml must be present
        contents = {
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
            "charts/imported_chart.yaml": yaml.safe_dump(chart_config),
        }
        command = ImportChartsCommand(contents)
        with pytest.raises(IncorrectVersionError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Missing metadata.yaml"

        # version should be 1.0.0
        contents["metadata.yaml"] = yaml.safe_dump(
            {
                "version": "2.0.0",
                "type": "SqlaTable",
                "timestamp": "2020-11-04T21:27:44.423819+00:00",
            }
        )
        command = ImportChartsCommand(contents)
        with pytest.raises(IncorrectVersionError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Must be equal to 1.0.0."

        # type should be Slice
        contents["metadata.yaml"] = yaml.safe_dump(database_metadata_config)
        command = ImportChartsCommand(contents)
        with pytest.raises(CommandInvalidError) as excinfo:
            command.run()
        assert str(excinfo.value).startswith("Error importing chart")
        assert excinfo.value.normalized_messages() == {
            "metadata.yaml": {"type": ["Must be equal to Slice."]}
        }

        # must also validate datasets and databases
        broken_config = database_config.copy()
        del broken_config["database_name"]
        contents["metadata.yaml"] = yaml.safe_dump(chart_metadata_config)
        contents["databases/imported_database.yaml"] = yaml.safe_dump(broken_config)
        command = ImportChartsCommand(contents)
        with pytest.raises(CommandInvalidError) as excinfo:
            command.run()
        assert str(excinfo.value).startswith("Error importing chart")
        assert excinfo.value.normalized_messages() == {
            "databases/imported_database.yaml": {
                "database_name": ["Missing data for required field."],
            }
        }


class TestChartsCreateCommand(SupersetTestCase):
    @patch("superset.utils.core.g")
    @patch("superset.commands.chart.create.g")
    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_create_v1_response(self, mock_sm_g, mock_c_g, mock_u_g):
        """Test that the create chart command creates a chart"""
        user = security_manager.find_user(username="admin")
        mock_u_g.user = mock_c_g.user = mock_sm_g.user = user
        chart_data = {
            "slice_name": "new chart",
            "description": "new description",
            "viz_type": "new_viz_type",
            "params": json.dumps({"viz_type": "new_viz_type"}),
            "cache_timeout": 1000,
            "datasource_id": 1,
            "datasource_type": "table",
        }
        command = CreateChartCommand(chart_data)
        chart = command.run()
        chart = db.session.query(Slice).get(chart.id)
        assert chart.viz_type == "new_viz_type"
        json_params = json.loads(chart.params)
        assert json_params == {"viz_type": "new_viz_type"}
        assert chart.slice_name == "new chart"
        assert len(chart.editors) == 1
        assert user_is_editor(user, chart)
        db.session.delete(chart)
        db.session.commit()


class TestChartsUpdateCommand(SupersetTestCase):
    @patch("superset.commands.chart.update.g")
    @patch("superset.utils.core.g")
    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_update_sets_last_saved_at(self, mock_sm_g, mock_c_g, mock_u_g):
        """Test that update sets last_saved_at when previously unset"""
        pk = db.session.query(Slice).all()[0].id
        user = security_manager.find_user(username="admin")
        mock_u_g.user = mock_c_g.user = mock_sm_g.user = user

        # Explicitly set last_saved_at to None to test None -> datetime transition
        chart_to_update = db.session.query(Slice).get(pk)
        chart_to_update.last_saved_at = None
        db.session.commit()

        command = UpdateChartCommand(
            pk,
            {"description": "test"},
        )
        command.run()

        chart = db.session.query(Slice).get(pk)
        assert chart.last_saved_at is not None
        assert chart.last_saved_by == user

    @patch("superset.commands.chart.update.g")
    @patch("superset.utils.core.g")
    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_update_changes_last_saved_at(self, mock_sm_g, mock_c_g, mock_u_g):
        """Test that update changes last_saved_at when it already has a value"""
        pk = db.session.query(Slice).all()[0].id
        user = security_manager.find_user(username="admin")
        mock_u_g.user = mock_c_g.user = mock_sm_g.user = user

        chart_to_update = db.session.query(Slice).get(pk)
        chart_to_update.last_saved_at = datetime.now()
        db.session.commit()
        # Refresh to get the database value with MySQL's truncated microseconds
        db.session.refresh(chart_to_update)
        last_saved_before = chart_to_update.last_saved_at

        command = UpdateChartCommand(
            pk,
            {"description": "test"},
        )
        # Sleep to ensure timestamp differs at MySQL's second precision (DATETIME(0))
        time.sleep(1)
        command.run()

        chart = db.session.query(Slice).get(pk)
        assert chart.last_saved_at.replace(microsecond=0) != last_saved_before.replace(
            microsecond=0
        )
        assert chart.last_saved_by == user

    @patch("superset.utils.core.g")
    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    @pytest.mark.skip(reason="This test will be changed to use the api/v1/data")
    def test_query_context_update_command(self, mock_sm_g, mock_g):
        """
        Test that a user can generate the chart query context
        payload without affecting editors
        """
        chart = db.session.query(Slice).all()[0]
        pk = chart.id
        admin = security_manager.find_user(username="admin")
        chart.editors = subjects_from_users([admin])
        db.session.commit()

        user = security_manager.find_user(username="alpha")
        mock_g.user = mock_sm_g.user = user
        query_context = json.dumps({"foo": "bar"})
        json_obj = {
            "query_context_generation": True,
            "query_context": query_context,
        }
        command = UpdateChartCommand(pk, json_obj)
        command.run()
        chart = db.session.query(Slice).get(pk)
        assert chart.query_context == query_context
        assert len(chart.editors) == 1
        assert user_is_editor(admin, chart)

    @patch("superset.commands.chart.update.ChartDAO.find_by_id")
    @patch("superset.commands.chart.update.g")
    @patch("superset.utils.core.g")
    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_query_context_update_requires_chart_access(
        self, mock_sm_g, mock_core_g, mock_update_g, mock_find_by_id
    ) -> None:
        """
        A query_context-only update relaxes the editor requirement but must
        still require access to the chart. We bypass the DAO ``ChartFilter``
        base filter (by patching ``find_by_id`` to return the chart directly)
        so the request reaches the new explicit ``raise_for_access`` check, and
        assert that a non-editor with no access to the chart's datasource is
        rejected with ``ChartForbiddenError``. This deterministically exercises
        the new branch and would fail on master, where the check is absent.
        """
        chart = db.session.query(Slice).filter_by(slice_name="Energy Sankey").one()
        pk = chart.id
        admin = security_manager.find_user(username="admin")
        chart.editors = subjects_from_users([admin])
        db.session.commit()

        # Return the chart directly, bypassing ChartFilter, so the command's
        # own raise_for_access gate is what denies the request.
        mock_find_by_id.return_value = chart

        # gamma has no access to the energy datasource and cannot edit the chart
        gamma = security_manager.find_user(username="gamma")
        mock_core_g.user = mock_sm_g.user = mock_update_g.user = gamma
        json_obj = {
            "query_context_generation": True,
            "query_context": json.dumps({"foo": "bar"}),
        }
        with pytest.raises(ChartForbiddenError):
            UpdateChartCommand(pk, json_obj).run()

    @patch("superset.commands.chart.update.g")
    @patch("superset.utils.core.g")
    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_update_chart_dashboard_security_existing_relationship(
        self, mock_sm_g, mock_u_g, mock_c_g
    ):
        """Test that chart editors can update charts linked to inaccessible
        dashboards (existing relationships)"""
        from superset.models.dashboard import Dashboard

        # Create a chart owned by alpha
        admin = security_manager.find_user(username="admin")
        alpha = security_manager.find_user(username="alpha")

        # Set user context for dashboard creation
        mock_u_g.user = mock_c_g.user = mock_sm_g.user = admin

        chart = db.session.query(Slice).first()
        chart.editors = subjects_from_users([alpha])

        # Create a dashboard owned by admin (not accessible to alpha)
        admin_dashboard = Dashboard(
            dashboard_title="Admin Dashboard",
            slug="admin-dashboard",
            editors=subjects_from_users([admin]),
            published=False,
        )
        db.session.add(admin_dashboard)

        # Link chart to admin's dashboard (alpha owns chart, admin owns dashboard)
        chart.dashboards.append(admin_dashboard)
        db.session.commit()

        # Alpha should still be able to update their chart
        # even though it's linked to admin's dashboard
        mock_u_g.user = mock_c_g.user = mock_sm_g.user = alpha

        json_obj = {
            "description": "Updated description",
            "dashboards": [
                d.id for d in chart.dashboards
            ],  # Keep existing relationships
        }
        command = UpdateChartCommand(chart.id, json_obj)
        command.run()

        # Should succeed - alpha can update their chart
        updated_chart = db.session.query(Slice).get(chart.id)
        assert updated_chart.description == "Updated description"

        # Clean up
        db.session.delete(admin_dashboard)
        db.session.commit()

    @patch("superset.commands.chart.update.g")
    @patch("superset.utils.core.g")
    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_update_chart_dashboard_security_new_unauthorized_relationship(
        self, mock_sm_g, mock_u_g, mock_c_g
    ):
        """Test that users cannot add charts to dashboards they don't have access to"""
        from superset.commands.chart.exceptions import ChartInvalidError
        from superset.models.dashboard import Dashboard

        admin = security_manager.find_user(username="admin")
        alpha = security_manager.find_user(username="alpha")

        # Set user context for dashboard creation
        mock_u_g.user = mock_c_g.user = mock_sm_g.user = admin

        # Create chart owned by alpha
        chart = db.session.query(Slice).first()
        chart.editors = subjects_from_users([alpha])

        # Create private dashboard owned by admin (not accessible to alpha)
        admin_dashboard = Dashboard(
            dashboard_title="Admin Private Dashboard",
            slug="admin-private-dashboard",
            editors=subjects_from_users([admin]),
            published=False,  # Private dashboard
        )
        db.session.add(admin_dashboard)
        db.session.commit()

        # Alpha tries to add their chart to admin's private dashboard
        mock_u_g.user = mock_c_g.user = mock_sm_g.user = alpha

        json_obj = {
            "description": "Trying to add to unauthorized dashboard",
            "dashboards": [admin_dashboard.id],  # NEW unauthorized relationship
        }
        command = UpdateChartCommand(chart.id, json_obj)

        # Should fail - alpha cannot access admin's private dashboard
        with self.assertRaises(ChartInvalidError):  # noqa: PT027
            command.run()

        # Clean up
        db.session.delete(admin_dashboard)
        db.session.commit()

    @patch("superset.commands.chart.update.g")
    @patch("superset.utils.core.g")
    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_update_chart_dashboard_security_admin_bypass(
        self, mock_sm_g, mock_u_g, mock_c_g
    ):
        """Test that admins can add charts to any dashboard"""
        from superset.models.dashboard import Dashboard

        admin = security_manager.find_user(username="admin")
        alpha = security_manager.find_user(username="alpha")

        # Set user context for dashboard creation
        mock_u_g.user = mock_c_g.user = mock_sm_g.user = alpha

        # Create chart owned by admin
        chart = db.session.query(Slice).first()
        chart.editors = subjects_from_users([admin])

        # Create private dashboard owned by alpha
        alpha_dashboard = Dashboard(
            dashboard_title="Alpha Private Dashboard",
            slug="alpha-private-dashboard",
            editors=subjects_from_users([alpha]),
            published=False,
        )
        db.session.add(alpha_dashboard)
        db.session.commit()

        # Admin should be able to add chart to any dashboard
        mock_u_g.user = mock_c_g.user = mock_sm_g.user = admin

        json_obj = {
            "description": "Admin adding to any dashboard",
            "dashboards": [alpha_dashboard.id],
        }
        command = UpdateChartCommand(chart.id, json_obj)
        command.run()

        # Should succeed - admin has access to all dashboards
        updated_chart = db.session.query(Slice).get(chart.id)
        assert alpha_dashboard in updated_chart.dashboards

        # Clean up
        db.session.delete(alpha_dashboard)
        db.session.commit()


class TestChartWarmUpCacheCommand(SupersetTestCase):
    def test_warm_up_cache_command_chart_not_found(self):
        with self.assertRaises(WarmUpCacheChartNotFoundError):  # noqa: PT027
            ChartWarmUpCacheCommand(99999, None, None).run()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @pytest.mark.skip(reason="This test will be changed to use the api/v1/data")
    def test_warm_up_cache(self):
        slc = self.get_slice("Top 10 Girl Name Share")
        result = ChartWarmUpCacheCommand(slc.id, None, None).run()
        assert result == {
            "chart_id": slc.id,
            "viz_error": None,
            "viz_status": "success",
        }

        # can just pass in chart as well
        result = ChartWarmUpCacheCommand(slc, None, None).run()
        assert result == {
            "chart_id": slc.id,
            "viz_error": None,
            "viz_status": "success",
        }


class TestFavoriteChartCommand(SupersetTestCase):
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_fave_unfave_chart_command(self):
        """Test that a user can fave/unfave a chart"""
        with self.client.application.test_request_context():
            example_chart = db.session.query(Slice).all()[0]

            # Assert that the chart exists
            assert example_chart is not None

            with override_user(security_manager.find_user("admin")):
                AddFavoriteChartCommand(example_chart.id).run()

                # Assert that the dashboard was faved
                ids = ChartDAO.favorited_ids([example_chart])
                assert example_chart.id in ids

                DelFavoriteChartCommand(example_chart.id).run()

                # Assert that the chart was unfaved
                ids = ChartDAO.favorited_ids([example_chart])
                assert example_chart.id not in ids

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_fave_unfave_chart_command_not_found(self):
        """Test that faving / unfaving a non-existing chart raises an exception"""
        with self.client.application.test_request_context():
            example_chart_id = 0

            with override_user(security_manager.find_user("admin")):
                with self.assertRaises(ChartNotFoundError):  # noqa: PT027
                    AddFavoriteChartCommand(example_chart_id).run()

                with self.assertRaises(ChartNotFoundError):  # noqa: PT027
                    DelFavoriteChartCommand(example_chart_id).run()

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    @patch("superset.daos.base.BaseDAO.find_by_id")
    def test_fave_unfave_chart_command_non_owner(self, mock_find_by_id):
        """Test that faving / unfaving a chart the user doesn't own works properly"""  # noqa: E501
        with self.client.application.test_request_context():
            example_chart = db.session.query(Slice).all()[0]
            mock_find_by_id.return_value = example_chart

            # Assert that the chart exists
            assert example_chart is not None

            # Grant gamma read access to the datasource so the access check passes.
            # Faving requires datasource access but not ownership.
            if example_chart.datasource:
                self.grant_role_access_to_table(example_chart.datasource, "Gamma")

            try:
                with override_user(security_manager.find_user("gamma")):
                    AddFavoriteChartCommand(example_chart.id).run()
                    ids = ChartDAO.favorited_ids([example_chart])

                    assert example_chart.id in ids

                    DelFavoriteChartCommand(example_chart.id).run()
                    ids = ChartDAO.favorited_ids([example_chart])

                    assert example_chart.id not in ids
            finally:
                if example_chart.datasource:
                    self.revoke_role_access_to_table("Gamma", example_chart.datasource)


def _create_chart_annotation_layer(name, descr=None):
    layer = AnnotationLayer(name=name, descr=descr)
    db.session.add(layer)
    db.session.commit()
    return layer


def _create_chart_annotation(
    layer,
    short_descr,
    long_descr=None,
    json_metadata=None,
):
    annotation = Annotation(
        layer=layer,
        short_descr=short_descr,
        long_descr=long_descr,
        json_metadata=json_metadata,
    )
    db.session.add(annotation)
    db.session.commit()
    return annotation


def _delete_chart_annotation_layer(layer):
    db.session.query(Annotation).filter(Annotation.layer_id == layer.id).delete()
    db.session.delete(layer)
    db.session.commit()


def _create_chart_dependency(source_chart, slice_name):
    chart = Slice(
        slice_name=slice_name,
        viz_type=source_chart.viz_type,
        datasource_id=source_chart.datasource_id,
        datasource_type=source_chart.datasource_type,
        params=source_chart.params,
        query_context=source_chart.query_context,
        cache_timeout=source_chart.cache_timeout,
    )
    db.session.add(chart)
    db.session.commit()
    return chart


def _delete_chart_dependency(chart):
    db.session.delete(chart)
    db.session.commit()


def _annotation_layer_import_config(layer_uuid, name, annotations, descr=None):
    return {
        "name": name,
        "descr": descr,
        "uuid": layer_uuid,
        "version": "1.0.0",
        "annotation": annotations,
    }


def _chart_import_config(chart_uuid, slice_name):
    config = deepcopy(chart_config)
    config["uuid"] = chart_uuid
    config["slice_name"] = slice_name
    return config


def _cleanup_imported_chart_bundle(chart_uuids, layer_uuids):
    for chart_uuid in chart_uuids:
        chart = db.session.query(Slice).filter_by(uuid=chart_uuid).one_or_none()
        if chart:
            db.session.delete(chart)
    for layer_uuid in layer_uuids:
        layer = (
            db.session.query(AnnotationLayer).filter_by(uuid=layer_uuid).one_or_none()
        )
        if layer:
            db.session.query(Annotation).filter(
                Annotation.layer_id == layer.id
            ).delete()
            db.session.delete(layer)
    dataset = (
        db.session.query(SqlaTable).filter_by(uuid=dataset_config["uuid"]).one_or_none()
    )
    if dataset:
        db.session.delete(dataset)
    database = (
        db.session.query(Database).filter_by(uuid=database_config["uuid"]).one_or_none()
    )
    if database:
        db.session.delete(database)
    db.session.commit()


class TestExportChartsAnnotationLayers(SupersetTestCase):
    """Tests for annotation layer handling in chart export."""

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_export_chart_multiple_native_annotation_layers_with_children(self, mock_g):
        """Export each referenced native layer once and preserve child annotations."""
        mock_g.user = security_manager.find_user("admin")
        chart = db.session.query(Slice).filter_by(slice_name="Energy Sankey").one()
        original_params = json.loads(chart.params or "{}")
        layer_one = _create_chart_annotation_layer(
            name=f"Layer One {uuid4()}", descr="first layer"
        )
        layer_two = _create_chart_annotation_layer(
            name=f"Layer Two {uuid4()}", descr="second layer"
        )
        unrelated_layer = _create_chart_annotation_layer(name=f"Unrelated {uuid4()}")
        try:
            _create_chart_annotation(
                layer_one,
                short_descr="layer-one-annotation",
                long_descr="layer-one-long",
                json_metadata='{"scope": "one"}',
            )
            _create_chart_annotation(
                layer_two,
                short_descr="layer-two-annotation",
                long_descr="layer-two-long",
                json_metadata='{"scope": "two"}',
            )
            chart.params = json.dumps(
                {
                    **original_params,
                    "annotation_layers": [
                        {
                            "name": "Native One",
                            "annotationType": "EVENT",
                            "sourceType": "NATIVE",
                            "value": layer_one.id,
                            "show": True,
                            "style": "solid",
                        },
                        {
                            "name": "Native Two",
                            "annotationType": "EVENT",
                            "sourceType": "NATIVE",
                            "value": layer_two.id,
                            "show": False,
                            "style": "dashed",
                        },
                    ],
                }
            )
            db.session.commit()

            contents = dict(ExportChartsCommand([chart.id]).run())
            chart_yaml = yaml.safe_load(
                contents[f"charts/Energy_Sankey_{chart.id}.yaml"]()
            )
            exported_layers = chart_yaml["params"]["annotation_layers"]

            assert [layer["value"] for layer in exported_layers] == [
                str(layer_one.uuid),
                str(layer_two.uuid),
            ]
            assert [layer["sourceType"] for layer in exported_layers] == [
                "NATIVE",
                "NATIVE",
            ]
            assert [layer["style"] for layer in exported_layers] == ["solid", "dashed"]
            assert [layer["show"] for layer in exported_layers] == [True, False]

            layer_payloads = {
                payload["uuid"]: payload
                for path, factory in contents.items()
                if path.startswith("annotation_layers/")
                for payload in [yaml.safe_load(factory())]
            }
            assert set(layer_payloads) == {str(layer_one.uuid), str(layer_two.uuid)}
            assert layer_payloads[str(layer_one.uuid)]["annotation"][0][
                "short_descr"
            ] == ("layer-one-annotation")
            assert layer_payloads[str(layer_two.uuid)]["annotation"][0][
                "short_descr"
            ] == ("layer-two-annotation")
            assert str(unrelated_layer.uuid) not in layer_payloads
        finally:
            chart.params = json.dumps(original_params)
            db.session.commit()
            _delete_chart_annotation_layer(unrelated_layer)
            _delete_chart_annotation_layer(layer_two)
            _delete_chart_annotation_layer(layer_one)

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_export_chart_duplicate_native_annotation_reference_deduplicates_files(
        self, mock_g
    ):
        """Raise when the same native layer id appears twice in one chart export."""
        mock_g.user = security_manager.find_user("admin")
        chart = db.session.query(Slice).filter_by(slice_name="Energy Sankey").one()
        original_params = json.loads(chart.params or "{}")
        layer = _create_chart_annotation_layer(name=f"Duplicate {uuid4()}")
        try:
            chart.params = json.dumps(
                {
                    **original_params,
                    "annotation_layers": [
                        {
                            "name": "Native One",
                            "annotationType": "EVENT",
                            "sourceType": "NATIVE",
                            "value": layer.id,
                        },
                        {
                            "name": "Native Two",
                            "annotationType": "EVENT",
                            "sourceType": "NATIVE",
                            "value": layer.id,
                        },
                    ],
                }
            )
            db.session.commit()

            with pytest.raises(AnnotationLayerNotFoundError):
                dict(ExportChartsCommand([chart.id]).run())
        finally:
            chart.params = json.dumps(original_params)
            db.session.commit()
            _delete_chart_annotation_layer(layer)

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_export_chart_missing_native_annotation_reference_preserves_value(
        self, mock_g
    ):
        """Raise when a native annotation references a missing layer during export."""
        mock_g.user = security_manager.find_user("admin")
        chart = db.session.query(Slice).filter_by(slice_name="Energy Sankey").one()
        original_params = json.loads(chart.params or "{}")
        missing_layer_id = 987654321
        try:
            chart.params = json.dumps(
                {
                    **original_params,
                    "annotation_layers": [
                        {
                            "name": "Missing Native",
                            "annotationType": "EVENT",
                            "sourceType": "NATIVE",
                            "value": missing_layer_id,
                        }
                    ],
                }
            )
            db.session.commit()

            with pytest.raises(AnnotationLayerNotFoundError):
                dict(ExportChartsCommand([chart.id]).run())
        finally:
            chart.params = json.dumps(original_params)
            db.session.commit()

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_export_chart_multiple_chart_annotation_references(self, mock_g):
        """Export each referenced table or line annotation chart exactly once."""
        mock_g.user = security_manager.find_user("admin")
        main_chart = db.session.query(Slice).filter_by(slice_name="Energy Sankey").one()
        original_params = json.loads(main_chart.params or "{}")
        ref_table_chart = _create_chart_dependency(
            main_chart,
            slice_name=f"Reference Table {uuid4()}",
        )
        ref_line_chart = _create_chart_dependency(
            main_chart,
            slice_name=f"Reference Line {uuid4()}",
        )
        try:
            main_chart.params = json.dumps(
                {
                    **original_params,
                    "annotation_layers": [
                        {
                            "name": "Table Ref",
                            "annotationType": "EVENT",
                            "sourceType": "table",
                            "value": ref_table_chart.id,
                            "show": True,
                        },
                        {
                            "name": "Line Ref",
                            "annotationType": "TIME_SERIES",
                            "sourceType": "line",
                            "value": ref_line_chart.id,
                            "show": False,
                        },
                    ],
                }
            )
            db.session.commit()

            contents = dict(ExportChartsCommand([main_chart.id]).run())
            chart_yaml = yaml.safe_load(
                contents[f"charts/Energy_Sankey_{main_chart.id}.yaml"]()
            )
            exported_layers = chart_yaml["params"]["annotation_layers"]
            assert exported_layers[0]["sourceType"] == "table"
            assert exported_layers[0]["value"] == str(ref_table_chart.uuid)
            assert exported_layers[1]["sourceType"] == "line"
            assert exported_layers[1]["value"] == str(ref_line_chart.uuid)
            ref_table_chart_path = (
                "charts/"
                f"{ref_table_chart.slice_name.replace(' ', '_')}"
                f"_{ref_table_chart.id}.yaml"
            )
            assert ref_table_chart_path in contents
            ref_line_chart_path = (
                "charts/"
                f"{ref_line_chart.slice_name.replace(' ', '_')}"
                f"_{ref_line_chart.id}.yaml"
            )
            assert ref_line_chart_path in contents
            assert not [
                path for path in contents if path.startswith("annotation_layers/")
            ]
        finally:
            main_chart.params = json.dumps(original_params)
            db.session.commit()
            _delete_chart_dependency(ref_line_chart)
            _delete_chart_dependency(ref_table_chart)

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_export_chart_missing_chart_annotation_reference_raises(self, mock_g):
        """Raise when table/line annotation references a missing chart during export."""
        mock_g.user = security_manager.find_user("admin")
        chart = db.session.query(Slice).filter_by(slice_name="Energy Sankey").one()
        original_params = json.loads(chart.params or "{}")
        missing_chart_id = 987654321
        try:
            chart.params = json.dumps(
                {
                    **original_params,
                    "annotation_layers": [
                        {
                            "name": "Missing Table Ref",
                            "annotationType": "EVENT",
                            "sourceType": "table",
                            "value": missing_chart_id,
                        }
                    ],
                }
            )
            db.session.commit()

            with pytest.raises(ChartNotFoundError):
                dict(ExportChartsCommand([chart.id]).run())
        finally:
            chart.params = json.dumps(original_params)
            db.session.commit()

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_export_chart_annotation_references_consistent_in_params_and_query_context(
        self, mock_g
    ):
        """Resolve same annotation refs in params and query context."""
        mock_g.user = security_manager.find_user("admin")
        main_chart = db.session.query(Slice).filter_by(slice_name="Energy Sankey").one()
        original_params = json.loads(main_chart.params or "{}")
        original_query_context = main_chart.query_context
        native_layer = _create_chart_annotation_layer(
            name=f"Native Query {uuid4()}", descr="query layer"
        )
        ref_chart = _create_chart_dependency(
            main_chart, slice_name=f"Query Ref {uuid4()}"
        )
        try:
            _create_chart_annotation(
                native_layer,
                short_descr="query-child",
                long_descr="query-child-long",
                json_metadata='{"color": "blue"}',
            )
            annotations = [
                {
                    "name": "Native",
                    "annotationType": "EVENT",
                    "sourceType": "NATIVE",
                    "value": native_layer.id,
                    "show": True,
                    "style": "solid",
                },
                {
                    "name": "Table",
                    "annotationType": "EVENT",
                    "sourceType": "table",
                    "value": ref_chart.id,
                    "show": True,
                    "style": "solid",
                },
                {
                    "name": "Formula",
                    "annotationType": "FORMULA",
                    "sourceType": "FORMULA",
                    "value": "cos(x)",
                    "show": False,
                    "style": "dashed",
                },
            ]
            main_chart.params = json.dumps(
                {
                    **original_params,
                    "annotation_layers": deepcopy(annotations),
                }
            )
            main_chart.query_context = json.dumps(
                {
                    "datasource": {"id": main_chart.datasource_id, "type": "table"},
                    "queries": [{"annotation_layers": deepcopy(annotations)}],
                    "form_data": {"annotation_layers": deepcopy(annotations)},
                }
            )
            db.session.commit()

            contents = dict(ExportChartsCommand([main_chart.id]).run())
            chart_yaml = yaml.safe_load(
                contents[f"charts/Energy_Sankey_{main_chart.id}.yaml"]()
            )
            params_layers = chart_yaml["params"]["annotation_layers"]
            query_context = json.loads(chart_yaml["query_context"])
            query_layers = query_context["queries"][0]["annotation_layers"]
            form_layers = query_context["form_data"]["annotation_layers"]

            expected_values = [str(native_layer.uuid), str(ref_chart.uuid), "cos(x)"]
            assert [layer["value"] for layer in params_layers] == expected_values
            assert [layer["value"] for layer in query_layers] == expected_values
            assert [layer["value"] for layer in form_layers] == expected_values

            layer_payloads = [
                yaml.safe_load(factory())
                for path, factory in contents.items()
                if path.startswith("annotation_layers/")
            ]
            assert len(layer_payloads) == 1
            assert layer_payloads[0]["uuid"] == str(native_layer.uuid)
            assert layer_payloads[0]["annotation"][0]["short_descr"] == "query-child"
            assert layer_payloads[0]["annotation"][0]["json_metadata"] == {
                "color": "blue"
            }
        finally:
            main_chart.params = json.dumps(original_params)
            main_chart.query_context = original_query_context
            db.session.commit()
            _delete_chart_dependency(ref_chart)
            _delete_chart_annotation_layer(native_layer)

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_export_chart_without_annotation_layers_adds_no_annotation_dependencies(
        self, mock_g
    ):
        """Export charts without annotation layers without adding layer artifacts."""
        mock_g.user = security_manager.find_user("admin")
        chart = db.session.query(Slice).filter_by(slice_name="Energy Sankey").one()
        original_params = json.loads(chart.params or "{}")
        original_query_context = chart.query_context
        try:
            params_without_annotations = deepcopy(original_params)
            params_without_annotations.pop("annotation_layers", None)
            chart.params = json.dumps(params_without_annotations)
            query_context = json.loads(chart.query_context or "{}")
            for query in query_context.get("queries", []):
                query["annotation_layers"] = []
            query_context.setdefault("form_data", {})["annotation_layers"] = []
            chart.query_context = json.dumps(query_context)
            db.session.commit()

            contents = dict(ExportChartsCommand([chart.id]).run())
            chart_yaml = yaml.safe_load(
                contents[f"charts/Energy_Sankey_{chart.id}.yaml"]()
            )
            assert chart_yaml.get("params", {}).get("annotation_layers", []) == []
            assert not [
                path for path in contents if path.startswith("annotation_layers/")
            ]
        finally:
            chart.params = json.dumps(original_params)
            chart.query_context = original_query_context
            db.session.commit()


class TestImportChartsAnnotationLayers(SupersetTestCase):
    """Tests for annotation layer handling during chart import."""

    @patch("superset.utils.core.g")
    @patch("superset.security.manager.g")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_chart_multiple_native_annotation_layers_with_children(
        self, mock_add_permissions, sm_g, utils_g
    ):
        """Import multiple native layers with child annotation linkage."""
        sm_g.user = utils_g.user = security_manager.find_user("admin")
        main_chart_uuid = str(uuid4())
        layer_one_uuid = str(uuid4())
        layer_two_uuid = str(uuid4())
        main_chart_config = _chart_import_config(
            main_chart_uuid, "Chart With Native Layers"
        )
        main_chart_config["params"]["annotation_layers"] = [
            {
                "name": "Native One",
                "annotationType": "EVENT",
                "sourceType": "NATIVE",
                "value": layer_one_uuid,
                "show": True,
                "style": "solid",
            },
            {
                "name": "Native Two",
                "annotationType": "EVENT",
                "sourceType": "NATIVE",
                "value": layer_two_uuid,
                "show": False,
                "style": "dashed",
            },
        ]

        contents = {
            "metadata.yaml": yaml.safe_dump(chart_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
            "charts/main_chart.yaml": yaml.safe_dump(main_chart_config),
            "annotation_layers/layer_one.yaml": yaml.safe_dump(
                _annotation_layer_import_config(
                    layer_one_uuid,
                    "Layer One",
                    [
                        {
                            "uuid": str(uuid4()),
                            "short_descr": "one-a",
                            "long_descr": "layer one annotation",
                            "json_metadata": {"layer": 1},
                        },
                        {
                            "uuid": str(uuid4()),
                            "short_descr": "one-b",
                            "long_descr": "layer one annotation two",
                            "json_metadata": {"layer": 1, "rank": 2},
                        },
                    ],
                    descr="layer one descr",
                )
            ),
            "annotation_layers/layer_two.yaml": yaml.safe_dump(
                _annotation_layer_import_config(
                    layer_two_uuid,
                    "Layer Two",
                    [
                        {
                            "uuid": str(uuid4()),
                            "short_descr": "two-a",
                            "long_descr": "layer two annotation",
                            "json_metadata": {"layer": 2},
                        }
                    ],
                    descr="layer two descr",
                )
            ),
        }

        try:
            ImportChartsCommand(contents, overwrite=True).run()

            chart = db.session.query(Slice).filter_by(uuid=main_chart_uuid).one()
            layer_one = (
                db.session.query(AnnotationLayer).filter_by(uuid=layer_one_uuid).one()
            )
            layer_two = (
                db.session.query(AnnotationLayer).filter_by(uuid=layer_two_uuid).one()
            )
            params_layers = json.loads(chart.params)["annotation_layers"]

            assert [layer["value"] for layer in params_layers] == [
                layer_one.id,
                layer_two.id,
            ]
            assert [layer["style"] for layer in params_layers] == ["solid", "dashed"]
            assert [layer["show"] for layer in params_layers] == [True, False]

            layer_one_annotations = (
                db.session.query(Annotation).filter_by(layer_id=layer_one.id).all()
            )
            layer_two_annotations = (
                db.session.query(Annotation).filter_by(layer_id=layer_two.id).all()
            )
            assert {annotation.short_descr for annotation in layer_one_annotations} == {
                "one-a",
                "one-b",
            }
            assert {annotation.short_descr for annotation in layer_two_annotations} == {
                "two-a"
            }
            assert all(
                annotation.layer_id == layer_one.id
                for annotation in layer_one_annotations
            )
            assert all(
                annotation.layer_id == layer_two.id
                for annotation in layer_two_annotations
            )
        finally:
            _cleanup_imported_chart_bundle(
                [main_chart_uuid], [layer_one_uuid, layer_two_uuid]
            )

    @patch("superset.utils.core.g")
    @patch("superset.security.manager.g")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_chart_mixed_annotation_dependency_graph(
        self, mock_add_permissions, sm_g, utils_g
    ):
        """Resolve mixed annotation source types across params and query context."""
        sm_g.user = utils_g.user = security_manager.find_user("admin")
        native_layer_uuid = str(uuid4())
        ref_table_uuid = str(uuid4())
        ref_line_uuid = str(uuid4())
        main_chart_uuid = str(uuid4())
        ref_table_chart = _chart_import_config(ref_table_uuid, "Ref Table Chart")
        ref_line_chart = _chart_import_config(ref_line_uuid, "Ref Line Chart")
        main_chart = _chart_import_config(main_chart_uuid, "Main Mixed Chart")

        annotations = [
            {
                "name": "Native",
                "annotationType": "EVENT",
                "sourceType": "NATIVE",
                "value": native_layer_uuid,
                "show": True,
                "style": "solid",
            },
            {
                "name": "Table",
                "annotationType": "EVENT",
                "sourceType": "table",
                "value": ref_table_uuid,
                "show": False,
                "style": "solid",
            },
            {
                "name": "Line",
                "annotationType": "TIME_SERIES",
                "sourceType": "line",
                "value": ref_line_uuid,
                "show": True,
                "style": "dashed",
            },
            {
                "name": "Formula",
                "annotationType": "FORMULA",
                "sourceType": "FORMULA",
                "value": "cos(x)",
                "show": True,
                "style": "solid",
            },
        ]
        main_chart["params"]["annotation_layers"] = deepcopy(annotations)
        main_chart["query_context"] = json.dumps(
            {
                "datasource": {"id": 12, "type": "table"},
                "queries": [{"annotation_layers": deepcopy(annotations)}],
                "form_data": {"annotation_layers": deepcopy(annotations)},
            }
        )

        contents = {
            "metadata.yaml": yaml.safe_dump(chart_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
            "charts/ref_table.yaml": yaml.safe_dump(ref_table_chart),
            "charts/ref_line.yaml": yaml.safe_dump(ref_line_chart),
            "charts/main_chart.yaml": yaml.safe_dump(main_chart),
            "annotation_layers/native_layer.yaml": yaml.safe_dump(
                _annotation_layer_import_config(
                    native_layer_uuid,
                    "Imported Native Layer",
                    [
                        {
                            "uuid": str(uuid4()),
                            "short_descr": "native-child",
                            "long_descr": "native child annotation",
                            "json_metadata": {"kind": "native"},
                        }
                    ],
                )
            ),
        }

        try:
            ImportChartsCommand(contents, overwrite=True).run()

            imported_main_chart = (
                db.session.query(Slice).filter_by(uuid=main_chart_uuid).one()
            )
            imported_table_chart = (
                db.session.query(Slice).filter_by(uuid=ref_table_uuid).one()
            )
            imported_line_chart = (
                db.session.query(Slice).filter_by(uuid=ref_line_uuid).one()
            )
            imported_native_layer = (
                db.session.query(AnnotationLayer)
                .filter_by(uuid=native_layer_uuid)
                .one()
            )

            params_layers = json.loads(imported_main_chart.params)["annotation_layers"]
            assert [layer["sourceType"] for layer in params_layers] == [
                "NATIVE",
                "table",
                "line",
                "FORMULA",
            ]
            assert [layer["value"] for layer in params_layers] == [
                imported_native_layer.id,
                imported_table_chart.id,
                imported_line_chart.id,
                "cos(x)",
            ]
            assert [layer["show"] for layer in params_layers] == [
                True,
                False,
                True,
                True,
            ]
            assert [layer["style"] for layer in params_layers] == [
                "solid",
                "solid",
                "dashed",
                "solid",
            ]

            query_context = json.loads(imported_main_chart.query_context)
            assert [
                layer["value"]
                for layer in query_context["queries"][0]["annotation_layers"]
            ] == [
                imported_native_layer.id,
                imported_table_chart.id,
                imported_line_chart.id,
                "cos(x)",
            ]
            assert [
                layer["value"]
                for layer in query_context["form_data"]["annotation_layers"]
            ] == [
                imported_native_layer.id,
                imported_table_chart.id,
                imported_line_chart.id,
                "cos(x)",
            ]
        finally:
            _cleanup_imported_chart_bundle(
                [main_chart_uuid, ref_table_uuid, ref_line_uuid],
                [native_layer_uuid],
            )

    @patch("superset.utils.core.g")
    @patch("superset.security.manager.g")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_chart_missing_annotation_layer_dependency_drops_reference(
        self, mock_add_permissions, sm_g, utils_g
    ):
        """Drop unresolved native layer UUID refs when dependency is missing."""
        sm_g.user = utils_g.user = security_manager.find_user("admin")
        main_chart_uuid = str(uuid4())
        missing_layer_uuid = str(uuid4())
        main_chart = _chart_import_config(main_chart_uuid, "Missing Native Layer")
        annotations = [
            {
                "name": "Missing Native",
                "annotationType": "EVENT",
                "sourceType": "NATIVE",
                "value": missing_layer_uuid,
                "show": True,
            }
        ]
        main_chart["params"]["annotation_layers"] = deepcopy(annotations)
        main_chart["query_context"] = json.dumps(
            {
                "datasource": {"id": 12, "type": "table"},
                "queries": [{"annotation_layers": deepcopy(annotations)}],
                "form_data": {"annotation_layers": deepcopy(annotations)},
            }
        )
        contents = {
            "metadata.yaml": yaml.safe_dump(chart_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
            "charts/main_chart.yaml": yaml.safe_dump(main_chart),
        }

        try:
            ImportChartsCommand(contents, overwrite=True).run()

            chart = db.session.query(Slice).filter_by(uuid=main_chart_uuid).one()
            assert json.loads(chart.params)["annotation_layers"] == []
            query_context = json.loads(chart.query_context)
            assert query_context["queries"][0]["annotation_layers"] == []
            assert query_context["form_data"]["annotation_layers"] == []
        finally:
            _cleanup_imported_chart_bundle([main_chart_uuid], [])

    @patch("superset.utils.core.g")
    @patch("superset.security.manager.g")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_chart_invalid_annotation_layer_uuid_drops_only_invalid_reference(
        self, mock_add_permissions, sm_g, utils_g
    ):
        """Drop invalid native UUID refs and keep formula annotations."""
        sm_g.user = utils_g.user = security_manager.find_user("admin")
        main_chart_uuid = str(uuid4())
        main_chart = _chart_import_config(main_chart_uuid, "Invalid Native UUID")
        annotations = [
            {
                "name": "Invalid Native",
                "annotationType": "EVENT",
                "sourceType": "NATIVE",
                "value": "not-a-uuid",
                "show": True,
            },
            {
                "name": "Formula",
                "annotationType": "FORMULA",
                "sourceType": "FORMULA",
                "value": "sin(x)",
                "show": False,
            },
        ]
        main_chart["params"]["annotation_layers"] = [
            *deepcopy(annotations),
        ]
        main_chart["query_context"] = json.dumps(
            {
                "datasource": {"id": 12, "type": "table"},
                "queries": [{"annotation_layers": deepcopy(annotations)}],
                "form_data": {"annotation_layers": deepcopy(annotations)},
            }
        )
        contents = {
            "metadata.yaml": yaml.safe_dump(chart_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
            "charts/main_chart.yaml": yaml.safe_dump(main_chart),
        }

        try:
            ImportChartsCommand(contents, overwrite=True).run()

            chart = db.session.query(Slice).filter_by(uuid=main_chart_uuid).one()
            params_layers = json.loads(chart.params)["annotation_layers"]
            assert len(params_layers) == 1
            assert params_layers[0]["annotationType"] == "FORMULA"
            assert params_layers[0]["value"] == "sin(x)"

            query_context = json.loads(chart.query_context)
            query_layers = query_context["queries"][0]["annotation_layers"]
            form_layers = query_context["form_data"]["annotation_layers"]
            assert [layer["value"] for layer in query_layers] == ["sin(x)"]
            assert [layer["value"] for layer in form_layers] == ["sin(x)"]
        finally:
            _cleanup_imported_chart_bundle([main_chart_uuid], [])

    @patch("superset.utils.core.g")
    @patch("superset.security.manager.g")
    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_chart_existing_annotation_layer_dependency_overwrite_reuses_layer(
        self, mock_add_permissions, sm_g, utils_g
    ):
        """Reuse and overwrite existing annotation layer on chart import."""
        sm_g.user = utils_g.user = security_manager.find_user("admin")
        existing_layer_uuid = str(uuid4())
        main_chart_uuid = str(uuid4())
        existing_layer = _create_chart_annotation_layer(
            name="existing-layer",
            descr="before overwrite",
        )
        existing_layer.uuid = existing_layer_uuid
        db.session.commit()
        existing_layer_id = existing_layer.id
        _create_chart_annotation(existing_layer, short_descr="stale-child")

        main_chart = _chart_import_config(
            main_chart_uuid, "Overwrite Native Layer Chart"
        )
        main_chart["params"]["annotation_layers"] = [
            {
                "name": "Native",
                "annotationType": "EVENT",
                "sourceType": "NATIVE",
                "value": existing_layer_uuid,
                "show": True,
                "style": "solid",
            }
        ]
        contents = {
            "metadata.yaml": yaml.safe_dump(chart_metadata_config),
            "databases/imported_database.yaml": yaml.safe_dump(database_config),
            "datasets/imported_dataset.yaml": yaml.safe_dump(dataset_config),
            "charts/main_chart.yaml": yaml.safe_dump(main_chart),
            "annotation_layers/native_layer.yaml": yaml.safe_dump(
                _annotation_layer_import_config(
                    existing_layer_uuid,
                    "existing-layer-updated",
                    [
                        {
                            "uuid": str(uuid4()),
                            "short_descr": "fresh-child",
                            "long_descr": "new annotation",
                            "json_metadata": {"fresh": True},
                        }
                    ],
                    descr="after overwrite",
                )
            ),
        }

        try:
            ImportChartsCommand(contents, overwrite=True).run()

            chart = db.session.query(Slice).filter_by(uuid=main_chart_uuid).one()
            layer = (
                db.session.query(AnnotationLayer)
                .filter_by(uuid=existing_layer_uuid)
                .one()
            )
            params_layers = json.loads(chart.params)["annotation_layers"]
            annotations = (
                db.session.query(Annotation).filter_by(layer_id=layer.id).all()
            )

            assert layer.id == existing_layer_id
            assert layer.name == "existing-layer-updated"
            assert layer.descr == "after overwrite"
            assert params_layers[0]["value"] == layer.id
            assert len(annotations) == 1
            assert annotations[0].short_descr == "fresh-child"
        finally:
            _cleanup_imported_chart_bundle([main_chart_uuid], [existing_layer_uuid])
