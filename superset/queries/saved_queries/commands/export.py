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
from superset.queries.saved_queries.commands.exceptions import SavedQueryNotFoundError
from superset.queries.saved_queries.dao import SavedQueryDAO
from superset.utils.dict_import_export import IMPORT_EXPORT_VERSION, sanitize
from superset.models.sql_lab import SavedQuery

logger = logging.getLogger(__name__)


class ExportSavedQueriesCommand(BaseCommand):
    def __init__(self, query_ids: List[int]):
        self.query_ids = query_ids

        # this will be set when calling validate()
        self._models: List[SavedQuery] = []

    @staticmethod
    def export_saved_query(query: SavedQuery) -> Iterator[Tuple[str, str]]:
        # build filename based on database, optional schema, and label
        database_slug = sanitize(query.database.database_name)
        schema_slug = sanitize(query.schema)
        query_slug = sanitize(query.label) or str(query.uuid)
        file_name = f"queries/{database_slug}/{schema_slug}/{query_slug}.yaml"

        payload = query.export_to_dict(
            recursive=False,
            include_parent_ref=False,
            include_defaults=True,
            export_uuids=True,
        )
        payload["version"] = IMPORT_EXPORT_VERSION
        payload["database_uuid"] = str(query.database.uuid)

        file_content = yaml.safe_dump(payload, sort_keys=False)
        yield file_name, file_content

        # include database as well
        file_name = f"databases/{database_slug}.yaml"

        payload = query.database.export_to_dict(
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
                logger.info("Unable to decode `extra` field: %s", payload["extra"])

        payload["version"] = IMPORT_EXPORT_VERSION

        file_content = yaml.safe_dump(payload, sort_keys=False)
        yield file_name, file_content

    def run(self) -> Iterator[Tuple[str, str]]:
        self.validate()

        for query in self._models:
            yield from self.export_saved_query(query)

    def validate(self) -> None:
        self._models = SavedQueryDAO.find_by_ids(self.query_ids)
        if len(self._models) != len(self.query_ids):
            raise SavedQueryNotFoundError()
