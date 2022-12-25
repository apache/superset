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
from typing import Any, Dict, List, Optional

from marshmallow import Schema
from marshmallow.exceptions import ValidationError
from sqlalchemy.orm import Session
from sqlalchemy.sql import delete, insert

from superset import db
from superset.charts.commands.importers.v1.utils import import_chart
from superset.charts.schemas import ImportV1ChartSchema
from superset.commands.base import BaseCommand
from superset.commands.exceptions import CommandInvalidError, ImportFailedError
from superset.commands.importers.v1.utils import (
    load_configs,
    load_metadata,
    validate_metadata_type,
)
from superset.dashboards.commands.importers.v1.utils import (
    find_chart_uuids,
    import_dashboard,
    update_id_refs,
)
from superset.dashboards.schemas import ImportV1DashboardSchema
from superset.databases.commands.importers.v1.utils import import_database
from superset.databases.schemas import ImportV1DatabaseSchema
from superset.datasets.commands.importers.v1.utils import import_dataset
from superset.datasets.schemas import ImportV1DatasetSchema
from superset.models.dashboard import dashboard_slices
from superset.queries.saved_queries.commands.importers.v1.utils import (
    import_saved_query,
)
from superset.queries.saved_queries.schemas import ImportV1SavedQuerySchema


class ImportAssetsCommand(BaseCommand):
    """
    Command for importing databases, datasets, charts, dashboards and saved queries.

    This command is used for managing Superset assets externally under source control,
    and will overwrite everything.
    """

    schemas: Dict[str, Schema] = {
        "charts/": ImportV1ChartSchema(),
        "dashboards/": ImportV1DashboardSchema(),
        "datasets/": ImportV1DatasetSchema(),
        "databases/": ImportV1DatabaseSchema(),
        "queries/": ImportV1SavedQuerySchema(),
    }

    # pylint: disable=unused-argument
    def __init__(self, contents: Dict[str, str], *args: Any, **kwargs: Any):
        self.contents = contents
        self.passwords: Dict[str, str] = kwargs.get("passwords") or {}
        self._configs: Dict[str, Any] = {}

    @staticmethod
    def _import(session: Session, configs: Dict[str, Any]) -> None:
        # import databases first
        database_ids: Dict[str, int] = {}
        for file_name, config in configs.items():
            if file_name.startswith("databases/"):
                database = import_database(session, config, overwrite=True)
                database_ids[str(database.uuid)] = database.id

        # import saved queries
        for file_name, config in configs.items():
            if file_name.startswith("queries/"):
                config["db_id"] = database_ids[config["database_uuid"]]
                import_saved_query(session, config, overwrite=True)

        # import datasets
        dataset_info: Dict[str, Dict[str, Any]] = {}
        for file_name, config in configs.items():
            if file_name.startswith("datasets/"):
                config["database_id"] = database_ids[config["database_uuid"]]
                dataset = import_dataset(session, config, overwrite=True)
                dataset_info[str(dataset.uuid)] = {
                    "datasource_id": dataset.id,
                    "datasource_type": dataset.datasource_type,
                    "datasource_name": dataset.table_name,
                }

        # import charts
        chart_ids: Dict[str, int] = {}
        for file_name, config in configs.items():
            if file_name.startswith("charts/"):
                config.update(dataset_info[config["dataset_uuid"]])
                chart = import_chart(session, config, overwrite=True)
                chart_ids[str(chart.uuid)] = chart.id

        # import dashboards
        for file_name, config in configs.items():
            if file_name.startswith("dashboards/"):
                config = update_id_refs(config, chart_ids, dataset_info)
                dashboard = import_dashboard(session, config, overwrite=True)

                # set ref in the dashboard_slices table
                dashboard_chart_ids: List[Dict[str, int]] = []
                for uuid in find_chart_uuids(config["position"]):
                    if uuid not in chart_ids:
                        break
                    chart_id = chart_ids[uuid]
                    dashboard_chart_id = {
                        "dashboard_id": dashboard.id,
                        "slice_id": chart_id,
                    }
                    dashboard_chart_ids.append(dashboard_chart_id)

                session.execute(
                    delete(dashboard_slices).where(
                        dashboard_slices.c.dashboard_id == dashboard.id
                    )
                )
                session.execute(insert(dashboard_slices).values(dashboard_chart_ids))

    def run(self) -> None:
        self.validate()

        # rollback to prevent partial imports
        try:
            self._import(db.session, self._configs)
            db.session.commit()
        except Exception as ex:
            db.session.rollback()
            raise ImportFailedError() from ex

    def validate(self) -> None:
        exceptions: List[ValidationError] = []

        # verify that the metadata file is present and valid
        try:
            metadata: Optional[Dict[str, str]] = load_metadata(self.contents)
        except ValidationError as exc:
            exceptions.append(exc)
            metadata = None
        validate_metadata_type(metadata, "assets", exceptions)

        self._configs = load_configs(
            self.contents, self.schemas, self.passwords, exceptions
        )

        if exceptions:
            exception = CommandInvalidError("Error importing assets")
            exception.add_list(exceptions)
            raise exception
