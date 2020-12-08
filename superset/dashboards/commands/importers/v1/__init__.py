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

from typing import Any, Dict, Iterator, List, Optional, Set, Tuple

from marshmallow import Schema, validate
from marshmallow.exceptions import ValidationError
from sqlalchemy.orm import Session
from sqlalchemy.sql import select

from superset import db
from superset.charts.commands.importers.v1.utils import import_chart
from superset.charts.schemas import ImportV1ChartSchema
from superset.commands.base import BaseCommand
from superset.commands.exceptions import CommandInvalidError
from superset.commands.importers.v1.utils import (
    load_metadata,
    load_yaml,
    METADATA_FILE_NAME,
)
from superset.dashboards.commands.exceptions import DashboardImportError
from superset.dashboards.commands.importers.v1.utils import import_dashboard
from superset.dashboards.schemas import ImportV1DashboardSchema
from superset.databases.commands.importers.v1.utils import import_database
from superset.databases.schemas import ImportV1DatabaseSchema
from superset.datasets.commands.importers.v1.utils import import_dataset
from superset.datasets.schemas import ImportV1DatasetSchema
from superset.models.core import Database
from superset.models.dashboard import Dashboard, dashboard_slices

schemas: Dict[str, Schema] = {
    "charts/": ImportV1ChartSchema(),
    "dashboards/": ImportV1DashboardSchema(),
    "datasets/": ImportV1DatasetSchema(),
    "databases/": ImportV1DatabaseSchema(),
}


def find_chart_uuids(position: Dict[str, Any]) -> Iterator[str]:
    """Find all chart UUIDs in a dashboard"""
    for child in position.values():
        if (
            isinstance(child, dict)
            and child["type"] == "CHART"
            and "uuid" in child["meta"]
        ):
            yield child["meta"]["uuid"]


class ImportDashboardsCommand(BaseCommand):

    """Import dashboards"""

    # pylint: disable=unused-argument
    def __init__(self, contents: Dict[str, str], *args: Any, **kwargs: Any):
        self.contents = contents
        self.passwords: Dict[str, str] = kwargs.get("passwords") or {}
        self._configs: Dict[str, Any] = {}

    # TODO (betodealmeida): refactor to use code from other commands
    # pylint: disable=too-many-branches, too-many-locals
    def _import_bundle(self, session: Session) -> None:
        # discover charts associated with dashboards
        chart_uuids: Set[str] = set()
        for file_name, config in self._configs.items():
            if file_name.startswith("dashboards/"):
                chart_uuids.update(find_chart_uuids(config["position"]))

        # discover datasets associated with charts
        dataset_uuids: Set[str] = set()
        for file_name, config in self._configs.items():
            if file_name.startswith("charts/") and config["uuid"] in chart_uuids:
                dataset_uuids.add(config["dataset_uuid"])

        # discover databases associated with datasets
        database_uuids: Set[str] = set()
        for file_name, config in self._configs.items():
            if file_name.startswith("datasets/") and config["uuid"] in dataset_uuids:
                database_uuids.add(config["database_uuid"])

        # import related databases
        database_ids: Dict[str, int] = {}
        for file_name, config in self._configs.items():
            if file_name.startswith("databases/") and config["uuid"] in database_uuids:
                database = import_database(session, config, overwrite=False)
                database_ids[str(database.uuid)] = database.id

        # import datasets with the correct parent ref
        dataset_info: Dict[str, Dict[str, Any]] = {}
        for file_name, config in self._configs.items():
            if (
                file_name.startswith("datasets/")
                and config["database_uuid"] in database_ids
            ):
                config["database_id"] = database_ids[config["database_uuid"]]
                dataset = import_dataset(session, config, overwrite=False)
                dataset_info[str(dataset.uuid)] = {
                    "datasource_id": dataset.id,
                    "datasource_type": "view" if dataset.is_sqllab_view else "table",
                    "datasource_name": dataset.table_name,
                }

        # import charts with the correct parent ref
        chart_ids: Dict[str, int] = {}
        for file_name, config in self._configs.items():
            if (
                file_name.startswith("charts/")
                and config["dataset_uuid"] in dataset_info
            ):
                # update datasource id, type, and name
                config.update(dataset_info[config["dataset_uuid"]])
                chart = import_chart(session, config, overwrite=False)
                chart_ids[str(chart.uuid)] = chart.id

        # store the existing relationship between dashboards and charts
        existing_relationships = session.execute(
            select([dashboard_slices.c.dashboard_id, dashboard_slices.c.slice_id])
        ).fetchall()

        # import dashboards
        dashboard_chart_ids: List[Tuple[int, int]] = []
        for file_name, config in self._configs.items():
            if file_name.startswith("dashboards/"):
                dashboard = import_dashboard(session, config, overwrite=True)

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

    def run(self) -> None:
        self.validate()

        # rollback to prevent partial imports
        try:
            self._import_bundle(db.session)
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise DashboardImportError()

    def validate(self) -> None:
        exceptions: List[ValidationError] = []

        # load existing databases so we can apply the password validation
        db_passwords = {
            str(uuid): password
            for uuid, password in db.session.query(
                Database.uuid, Database.password
            ).all()
        }

        # verify that the metadata file is present and valid
        try:
            metadata: Optional[Dict[str, str]] = load_metadata(self.contents)
        except ValidationError as exc:
            exceptions.append(exc)
            metadata = None

        # validate dashboards, charts, datasets, and databases
        for file_name, content in self.contents.items():
            prefix = file_name.split("/")[0]
            schema = schemas.get(f"{prefix}/")
            if schema:
                try:
                    config = load_yaml(file_name, content)

                    # populate passwords from the request or from existing DBs
                    if file_name in self.passwords:
                        config["password"] = self.passwords[file_name]
                    elif prefix == "databases" and config["uuid"] in db_passwords:
                        config["password"] = db_passwords[config["uuid"]]

                    schema.load(config)
                    self._configs[file_name] = config
                except ValidationError as exc:
                    exc.messages = {file_name: exc.messages}
                    exceptions.append(exc)

        # validate that the type declared in METADATA_FILE_NAME is correct
        if metadata:
            type_validator = validate.Equal(Dashboard.__name__)
            try:
                type_validator(metadata["type"])
            except ValidationError as exc:
                exc.messages = {METADATA_FILE_NAME: {"type": exc.messages}}
                exceptions.append(exc)

        if exceptions:
            exception = CommandInvalidError("Error importing dashboard")
            exception.add_list(exceptions)
            raise exception
