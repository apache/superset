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

from typing import Any, Dict, List, Tuple

from marshmallow import Schema
from sqlalchemy.orm import Session
from sqlalchemy.sql import select

from superset import db
from superset.charts.commands.importers.v1.utils import import_chart
from superset.charts.schemas import ImportV1ChartSchema
from superset.commands.exceptions import CommandException
from superset.commands.importers.v1 import ImportModelsCommand
from superset.dao.base import BaseDAO
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
from superset.models.core import Database
from superset.models.dashboard import dashboard_slices


class ImportExamplesCommand(ImportModelsCommand):

    """Import examples"""

    dao = BaseDAO
    model_name = "model"
    schemas: Dict[str, Schema] = {
        "charts/": ImportV1ChartSchema(),
        "dashboards/": ImportV1DashboardSchema(),
        "datasets/": ImportV1DatasetSchema(),
        "databases/": ImportV1DatabaseSchema(),
    }
    import_error = CommandException

    def __init__(self, contents: Dict[str, str], *args: Any, **kwargs: Any):
        super().__init__(contents, *args, **kwargs)
        self.force_data = kwargs.get("force_data", False)

    def run(self) -> None:
        self.validate()

        # rollback to prevent partial imports
        try:
            self._import(db.session, self._configs, self.overwrite, self.force_data)
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise self.import_error()

    # pylint: disable=too-many-locals, arguments-differ
    @staticmethod
    def _import(
        session: Session,
        configs: Dict[str, Any],
        overwrite: bool = False,
        force_data: bool = False,
    ) -> None:
        # import databases
        database_ids: Dict[str, int] = {}
        for file_name, config in configs.items():
            if file_name.startswith("databases/"):
                database = import_database(session, config, overwrite=overwrite)
                database_ids[str(database.uuid)] = database.id

        # import datasets
        # TODO (betodealmeida): once we have all examples being imported we can
        # have a stable UUID for the database stored in the dataset YAML; for
        # now we need to fetch the current ID.
        examples_id = (
            db.session.query(Database).filter_by(database_name="examples").one().id
        )
        dataset_info: Dict[str, Dict[str, Any]] = {}
        for file_name, config in configs.items():
            if file_name.startswith("datasets/"):
                config["database_id"] = examples_id
                dataset = import_dataset(
                    session, config, overwrite=overwrite, force_data=force_data
                )
                dataset_info[str(dataset.uuid)] = {
                    "datasource_id": dataset.id,
                    "datasource_type": "view" if dataset.is_sqllab_view else "table",
                    "datasource_name": dataset.table_name,
                }

        # import charts
        chart_ids: Dict[str, int] = {}
        for file_name, config in configs.items():
            if file_name.startswith("charts/"):
                # update datasource id, type, and name
                config.update(dataset_info[config["dataset_uuid"]])
                chart = import_chart(session, config, overwrite=overwrite)
                chart_ids[str(chart.uuid)] = chart.id

        # store the existing relationship between dashboards and charts
        existing_relationships = session.execute(
            select([dashboard_slices.c.dashboard_id, dashboard_slices.c.slice_id])
        ).fetchall()

        # import dashboards
        dashboard_chart_ids: List[Tuple[int, int]] = []
        for file_name, config in configs.items():
            if file_name.startswith("dashboards/"):
                config = update_id_refs(config, chart_ids)
                dashboard = import_dashboard(session, config, overwrite=overwrite)
                for uuid in find_chart_uuids(config["position"]):
                    chart_id = chart_ids[uuid]
                    if (dashboard.id, chart_id) not in existing_relationships:
                        dashboard_chart_ids.append((dashboard.id, chart_id))

        # set ref in the dashboard_slices table
        values = [
            {"dashboard_id": dashboard_id, "slice_id": chart_id}
            for (dashboard_id, chart_id) in dashboard_chart_ids
        ]
        # pylint: disable=no-value-for-parameter (sqlalchemy/issues/4656)
        session.execute(dashboard_slices.insert(), values)
