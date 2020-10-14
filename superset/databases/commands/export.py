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
import os.path
from io import BytesIO
from typing import Any, cast, Dict, Optional
from zipfile import ZipFile

import yaml

from superset.commands.base import BaseCommand
from superset.databases.commands.exceptions import DatabaseNotFoundError
from superset.databases.dao import DatabaseDAO
from superset.utils.dict_import_export import IMPORT_EXPORT_VERSION, sanitize
from superset.models.core import Database


class ExportDatabaseCommand(BaseCommand):
    def __init__(self, database_id: int, filename: str):
        self.database_id = database_id
        self.filename = filename

        # this will be set when calling validate()
        self._model: Optional[Database] = None

    def run(self) -> BytesIO:
        self.validate()
        database = cast(Database, self._model)

        root = os.path.splitext(self.filename)[0]
        name = sanitize(database.database_name)
        database_filename = f"{root}/databases/{name}.yaml"

        payload: Dict[Any, Any]
        payload = database.export_to_dict(
            recursive=False,
            include_parent_ref=False,
            include_defaults=True,
            export_uuids=True,
        )
        if "extra" in payload:
            try:
                payload["extra"] = json.loads(payload["extra"])
            except json.decoder.JSONDecodeError:
                pass

        payload["version"] = IMPORT_EXPORT_VERSION

        buf = BytesIO()
        with ZipFile(buf, "w") as bundle:
            with bundle.open(database_filename, "w") as fp:
                fp.write(yaml.safe_dump(payload, sort_keys=False).encode())

            for dataset in database.tables:
                name = sanitize(dataset.table_name)
                dataset_filename = f"{root}/datasets/{name}.yaml"

                # TODO (betodealmeida): reuse logic from ExportDatasetCommand
                # once it's implemented
                payload = dataset.export_to_dict(
                    recursive=True,
                    include_parent_ref=False,
                    include_defaults=True,
                    export_uuids=True,
                )
                payload["version"] = IMPORT_EXPORT_VERSION
                payload["database_uuid"] = str(database.uuid)

                with bundle.open(dataset_filename, "w") as fp:
                    fp.write(yaml.safe_dump(payload, sort_keys=False).encode())

        return buf

    def validate(self) -> None:
        self._model = DatabaseDAO.find_by_id(self.database_id)
        if not self._model:
            raise DatabaseNotFoundError()
