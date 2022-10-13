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

from datetime import datetime, timezone
from typing import Iterator, Tuple

import yaml

from superset.charts.commands.export import ExportChartsCommand
from superset.commands.base import BaseCommand
from superset.dashboards.commands.export import ExportDashboardsCommand
from superset.databases.commands.export import ExportDatabasesCommand
from superset.datasets.commands.export import ExportDatasetsCommand
from superset.queries.saved_queries.commands.export import ExportSavedQueriesCommand
from superset.utils.dict_import_export import EXPORT_VERSION

METADATA_FILE_NAME = "metadata.yaml"


class ExportAssetsCommand(BaseCommand):
    """
    Command that exports all databases, datasets, charts, dashboards and saved queries.
    """

    def run(self) -> Iterator[Tuple[str, str]]:

        metadata = {
            "version": EXPORT_VERSION,
            "type": "assets",
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        }
        yield METADATA_FILE_NAME, yaml.safe_dump(metadata, sort_keys=False)
        seen = {METADATA_FILE_NAME}

        commands = [
            ExportDatabasesCommand,
            ExportDatasetsCommand,
            ExportChartsCommand,
            ExportDashboardsCommand,
            ExportSavedQueriesCommand,
        ]
        for command in commands:
            ids = [model.id for model in command.dao.find_all()]
            for file_name, file_content in command(ids, export_related=False).run():
                if file_name not in seen:
                    yield file_name, file_content
                    seen.add(file_name)

    def validate(self) -> None:
        pass
