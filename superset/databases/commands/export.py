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
# isort:skip_file

import json
import logging
from typing import Iterator, List, Tuple

import yaml

from superset.commands.base import BaseCommand
from superset.databases.commands.exceptions import DatabaseNotFoundError
from superset.databases.dao import DatabaseDAO
from superset.utils.dict_import_export import IMPORT_EXPORT_VERSION, sanitize
from superset.models.core import Database

logger = logging.getLogger(__name__)


class ExportDatabasesCommand(BaseCommand):
    def __init__(self, database_ids: List[int]):
        self.database_ids = database_ids

        # this will be set when calling validate()
        self._models: List[Database] = []

    @staticmethod
    def export_database(database: Database) -> Iterator[Tuple[str, str]]:
        database_slug = sanitize(database.database_name)
        file_name = f"databases/{database_slug}.yaml"

        payload = database.export_to_dict(
            recursive=False,
            include_parent_ref=False,
            include_defaults=True,
            export_uuids=True,
        )
        # TODO (betodealmeida): move this logic to export_to_dict once this
        # becomes the default export endpoint
        if "extra" in payload:
            try:
                payload["extra"] = json.loads(payload["extra"])
            except json.decoder.JSONDecodeError:
                logger.info(f"Unable to decode `extra` field: {payload['extra']}")

        payload["version"] = IMPORT_EXPORT_VERSION

        file_content = yaml.safe_dump(payload, sort_keys=False)
        yield file_name, file_content

        for dataset in database.tables:
            dataset_slug = sanitize(dataset.table_name)
            file_name = f"datasets/{database_slug}/{dataset_slug}.yaml"

            payload = dataset.export_to_dict(
                recursive=True,
                include_parent_ref=False,
                include_defaults=True,
                export_uuids=True,
            )
            payload["version"] = IMPORT_EXPORT_VERSION
            payload["database_uuid"] = str(database.uuid)

            file_content = yaml.safe_dump(payload, sort_keys=False)
            yield file_name, file_content

    def run(self) -> Iterator[Tuple[str, str]]:
        self.validate()

        for database in self._models:
            yield from self.export_database(database)

    def validate(self) -> None:
        self._models = DatabaseDAO.find_by_ids(self.database_ids)
        if len(self._models) != len(self.database_ids):
            raise DatabaseNotFoundError()
