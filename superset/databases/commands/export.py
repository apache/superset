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
from typing import Iterator, Tuple

import yaml
from werkzeug.utils import secure_filename

from superset.databases.commands.exceptions import DatabaseNotFoundError
from superset.databases.dao import DatabaseDAO
from superset.commands.export import ExportModelsCommand
from superset.models.core import Database
from superset.utils.dict_import_export import EXPORT_VERSION

logger = logging.getLogger(__name__)


class ExportDatabasesCommand(ExportModelsCommand):

    dao = DatabaseDAO
    not_found = DatabaseNotFoundError

    @staticmethod
    def _export(model: Database) -> Iterator[Tuple[str, str]]:
        database_slug = secure_filename(model.database_name)
        file_name = f"databases/{database_slug}.yaml"

        payload = model.export_to_dict(
            recursive=False,
            include_parent_ref=False,
            include_defaults=True,
            export_uuids=True,
        )
        # TODO (betodealmeida): move this logic to export_to_dict once this
        # becomes the default export endpoint
        if payload.get("extra"):
            try:
                payload["extra"] = json.loads(payload["extra"])
            except json.decoder.JSONDecodeError:
                logger.info("Unable to decode `extra` field: %s", payload["extra"])

        payload["version"] = EXPORT_VERSION

        file_content = yaml.safe_dump(payload, sort_keys=False)
        yield file_name, file_content

        for dataset in model.tables:
            dataset_slug = secure_filename(dataset.table_name)
            file_name = f"datasets/{database_slug}/{dataset_slug}.yaml"

            payload = dataset.export_to_dict(
                recursive=True,
                include_parent_ref=False,
                include_defaults=True,
                export_uuids=True,
            )
            payload["version"] = EXPORT_VERSION
            payload["database_uuid"] = str(model.uuid)

            file_content = yaml.safe_dump(payload, sort_keys=False)
            yield file_name, file_content
