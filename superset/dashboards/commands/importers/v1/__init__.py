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

from typing import Any, Dict, List, Set, Tuple

from marshmallow import Schema
from sqlalchemy.orm import Session
from sqlalchemy.sql import select

from superset.charts.commands.importers.v1.utils import import_chart
from superset.charts.schemas import ImportV1ChartSchema
from superset.commands.importers.v1 import ImportModelsCommand
from superset.dashboards.commands.exceptions import DashboardImportError
from superset.dashboards.commands.importers.v1.utils import (
    find_chart_uuids,
    find_native_filter_datasets,
    import_dashboard,
    update_id_refs,
)
from superset.dashboards.dao import DashboardDAO
from superset.dashboards.schemas import ImportV1DashboardSchema
from superset.databases.commands.importers.v1.utils import import_database
from superset.databases.schemas import ImportV1DatabaseSchema
from superset.datasets.commands.importers.v1.utils import import_dataset
from superset.datasets.schemas import ImportV1DatasetSchema
from superset.models.dashboard import Dashboard, dashboard_slices, DashboardRoles
from superset.models.superset_core.role import SupersetRole
from superset.role.commands.importer.utils import import_role
from superset.role.schemas import ImportV1RoleSchema


class ImportDashboardsCommand(ImportModelsCommand):

    """Import dashboards"""

    dao = DashboardDAO
    model_name = "dashboard"
    prefix = "dashboards/"
    schemas: Dict[str, Schema] = {
        "charts/": ImportV1ChartSchema(),
        "dashboards/": ImportV1DashboardSchema(),
        "datasets/": ImportV1DatasetSchema(),
        "databases/": ImportV1DatabaseSchema(),
        "roles/": ImportV1RoleSchema(),
    }
    import_error = DashboardImportError

    # TODO (betodealmeida): refactor to use code from other commands
    # pylint: disable=too-many-branches, too-many-locals
    @staticmethod
    def _import(
        session: Session, configs: Dict[str, Any], overwrite: bool = False
    ) -> None:
        # discover charts and datasets associated with dashboards
        chart_uuids: Set[str] = set()
        dataset_uuids: Set[str] = set()
        for file_name, config in configs.items():
            if file_name.startswith("dashboards/"):
                chart_uuids.update(find_chart_uuids(config["position"]))
                dataset_uuids.update(
                    find_native_filter_datasets(config.get("metadata", {}))
                )

        # discover datasets associated with charts
        for file_name, config in configs.items():
            if file_name.startswith("charts/") and config["uuid"] in chart_uuids:
                dataset_uuids.add(config["dataset_uuid"])

        # discover databases associated with datasets
        database_uuids: Set[str] = set()
        for file_name, config in configs.items():
            if file_name.startswith("datasets/") and config["uuid"] in dataset_uuids:
                database_uuids.add(config["database_uuid"])

        # discover roles associated with dashboard
        role_ids: Dict[str, int] = {}
        for file_name, config in configs.items():
            if file_name.startswith("roles/"):
                role = import_role(session, config, overwrite=False)
                role_ids[role.name] = role.id

        # import related roles
        # for file_name, config in configs.items():
        #     if file_name.startswith("roles/") and config["name"] in role_names:

        # import related databases
        database_ids: Dict[str, int] = {}
        for file_name, config in configs.items():
            if file_name.startswith("databases/") and config["uuid"] in database_uuids:
                database = import_database(session, config, overwrite=False)
                database_ids[str(database.uuid)] = database.id

        # import datasets with the correct parent ref
        dataset_info: Dict[str, Dict[str, Any]] = {}
        for file_name, config in configs.items():
            if (
                file_name.startswith("datasets/")
                and config["database_uuid"] in database_ids
            ):
                config["database_id"] = database_ids[config["database_uuid"]]
                dataset = import_dataset(session, config, overwrite=False)
                dataset_info[str(dataset.uuid)] = {
                    "datasource_id": dataset.id,
                    "datasource_type": dataset.datasource_type,
                    "datasource_name": dataset.table_name,
                }

        # import charts with the correct parent ref
        chart_ids: Dict[str, int] = {}
        for file_name, config in configs.items():
            if (
                file_name.startswith("charts/")
                and config["dataset_uuid"] in dataset_info
            ):
                # update datasource id, type, and name
                config.update(dataset_info[config["dataset_uuid"]])
                chart = import_chart(session, config, overwrite=False)
                chart_ids[str(chart.uuid)] = chart.id

        # store the existing relationship between dashboards and charts
        dashboards_slice_existing_relationships = session.execute(
            select([dashboard_slices.c.dashboard_id, dashboard_slices.c.slice_id])
        ).fetchall()

        dashboards_role_existing_relationships_query = (
            session.query([Dashboard.uuid, SupersetRole.name])
            .join(SupersetRole)
            .join(DashboardRoles)
            .join(Dashboard)
        )
        dashboards_role_existing_relationships_all = (
            dashboards_role_existing_relationships_query.all()
        )

        # import dashboards
        dashboard_chart_new_ids: List[Tuple[int, int]] = []
        dashboard_role_new_ids: List[Tuple[int, int]] = []
        for file_name, config in configs.items():
            if file_name.startswith("dashboards/"):
                config = update_id_refs(config, chart_ids, dataset_info)
                dashboard = import_dashboard(session, config, overwrite=overwrite)
                for uuid in find_chart_uuids(config["position"]):
                    if uuid not in chart_ids:
                        break
                    chart_id = chart_ids[uuid]
                    if (
                        dashboard.id,
                        chart_id,
                    ) not in dashboards_slice_existing_relationships:
                        dashboard_chart_new_ids.append((dashboard.id, chart_id))

                for role in config["roles"]:
                    if (
                        dashboard.uuid,
                        role["name"],
                    ) not in dashboards_role_existing_relationships_all:
                        dashboard_role_new_ids.append((dashboard.id, role["id"]))

        # set ref in the dashboard_slices table
        dashboard_slice_new_values = [
            {"dashboard_id": dashboard_id, "slice_id": chart_id}
            for (dashboard_id, chart_id) in dashboard_chart_new_ids
        ]
        # pylint: disable=no-value-for-parameter # sqlalchemy/issues/4656
        session.execute(dashboard_slices.insert(), dashboard_slice_new_values)

        dashboard_role_new_values = [
            {"dashboard_id": dashboard_id, "role_id": role_id}
            for (dashboard_id, role_id) in dashboard_role_new_ids
        ]
        session.execute(DashboardRoles.insert(), dashboard_role_new_values)
