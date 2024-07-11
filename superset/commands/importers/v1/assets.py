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
from functools import partial
from typing import Any, Optional

from marshmallow import Schema
from marshmallow.exceptions import ValidationError
from sqlalchemy.sql import delete, insert

from superset import db
from superset.charts.schemas import ImportV1ChartSchema
from superset.commands.base import BaseCommand
from superset.commands.chart.importers.v1.utils import import_chart
from superset.commands.dashboard.importers.v1.utils import (
    find_chart_uuids,
    import_dashboard,
    update_id_refs,
)
from superset.commands.database.importers.v1.utils import import_database
from superset.commands.dataset.importers.v1.utils import import_dataset
from superset.commands.exceptions import CommandInvalidError, ImportFailedError
from superset.commands.importers.v1.utils import (
    load_configs,
    load_metadata,
    validate_metadata_type,
)
from superset.commands.query.importers.v1.utils import import_saved_query
from superset.dashboards.schemas import ImportV1DashboardSchema
from superset.databases.schemas import ImportV1DatabaseSchema
from superset.datasets.schemas import ImportV1DatasetSchema
from superset.migrations.shared.native_filters import migrate_dashboard
from superset.models.dashboard import dashboard_slices
from superset.queries.saved_queries.schemas import ImportV1SavedQuerySchema
from superset.utils.decorators import on_error, transaction


class ImportAssetsCommand(BaseCommand):
    """
    Command for importing databases, datasets, charts, dashboards and saved queries.

    This command is used for managing Superset assets externally under source control,
    and will overwrite everything.
    """

    schemas: dict[str, Schema] = {
        "charts/": ImportV1ChartSchema(),
        "dashboards/": ImportV1DashboardSchema(),
        "datasets/": ImportV1DatasetSchema(),
        "databases/": ImportV1DatabaseSchema(),
        "queries/": ImportV1SavedQuerySchema(),
    }

    # pylint: disable=unused-argument
    def __init__(self, contents: dict[str, str], *args: Any, **kwargs: Any):
        self.contents = contents
        self.passwords: dict[str, str] = kwargs.get("passwords") or {}
        self.ssh_tunnel_passwords: dict[str, str] = (
            kwargs.get("ssh_tunnel_passwords") or {}
        )
        self.ssh_tunnel_private_keys: dict[str, str] = (
            kwargs.get("ssh_tunnel_private_keys") or {}
        )
        self.ssh_tunnel_priv_key_passwords: dict[str, str] = (
            kwargs.get("ssh_tunnel_priv_key_passwords") or {}
        )
        self._configs: dict[str, Any] = {}

    # pylint: disable=too-many-locals
    @staticmethod
    def _import(configs: dict[str, Any]) -> None:
        # import databases first
        database_ids: dict[str, int] = {}
        for file_name, config in configs.items():
            if file_name.startswith("databases/"):
                database = import_database(config, overwrite=True)
                database_ids[str(database.uuid)] = database.id

        # import saved queries
        for file_name, config in configs.items():
            if file_name.startswith("queries/"):
                config["db_id"] = database_ids[config["database_uuid"]]
                import_saved_query(config, overwrite=True)

        # import datasets
        dataset_info: dict[str, dict[str, Any]] = {}
        for file_name, config in configs.items():
            if file_name.startswith("datasets/"):
                config["database_id"] = database_ids[config["database_uuid"]]
                dataset = import_dataset(config, overwrite=True)
                dataset_info[str(dataset.uuid)] = {
                    "datasource_id": dataset.id,
                    "datasource_type": dataset.datasource_type,
                    "datasource_name": dataset.table_name,
                }

        # import charts
        charts = []
        chart_ids: dict[str, int] = {}
        for file_name, config in configs.items():
            if file_name.startswith("charts/"):
                dataset_dict = dataset_info[config["dataset_uuid"]]
                config.update(dataset_dict)
                dataset_uid = f"{dataset_dict['datasource_id']}__{dataset_dict['datasource_type']}"
                config["params"].update({"datasource": dataset_uid})
                if "query_context" in config:
                    config["query_context"] = None
                chart = import_chart(config, overwrite=True)
                charts.append(chart)
                chart_ids[str(chart.uuid)] = chart.id

        # import dashboards
        for file_name, config in configs.items():
            if file_name.startswith("dashboards/"):
                config = update_id_refs(config, chart_ids, dataset_info)
                dashboard = import_dashboard(config, overwrite=True)

                # set ref in the dashboard_slices table
                dashboard_chart_ids: list[dict[str, int]] = []
                for uuid in find_chart_uuids(config["position"]):
                    if uuid not in chart_ids:
                        break
                    chart_id = chart_ids[uuid]
                    dashboard_chart_id = {
                        "dashboard_id": dashboard.id,
                        "slice_id": chart_id,
                    }
                    dashboard_chart_ids.append(dashboard_chart_id)

                db.session.execute(
                    delete(dashboard_slices).where(
                        dashboard_slices.c.dashboard_id == dashboard.id
                    )
                )
                db.session.execute(insert(dashboard_slices).values(dashboard_chart_ids))

                # Migrate any filter-box charts to native dashboard filters.
                migrate_dashboard(dashboard)

        # Remove all obsolete filter-box charts.
        for chart in charts:
            if chart.viz_type == "filter_box":
                db.session.delete(chart)

    @transaction(
        on_error=partial(
            on_error,
            catches=(Exception,),
            reraise=ImportFailedError,
        )
    )
    def run(self) -> None:
        self.validate()
        self._import(self._configs)

    def validate(self) -> None:
        exceptions: list[ValidationError] = []

        # verify that the metadata file is present and valid
        try:
            metadata: Optional[dict[str, str]] = load_metadata(self.contents)
        except ValidationError as exc:
            exceptions.append(exc)
            metadata = None
        validate_metadata_type(metadata, "assets", exceptions)

        self._configs = load_configs(
            self.contents,
            self.schemas,
            self.passwords,
            exceptions,
            self.ssh_tunnel_passwords,
            self.ssh_tunnel_private_keys,
            self.ssh_tunnel_priv_key_passwords,
        )

        if exceptions:
            raise CommandInvalidError(
                "Error importing assets",
                exceptions,
            )
