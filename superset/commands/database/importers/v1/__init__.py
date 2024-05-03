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

from typing import Any

from marshmallow import Schema
from sqlalchemy.orm import Session  # noqa: F401

from superset.commands.database.exceptions import DatabaseImportError
from superset.commands.database.importers.v1.utils import import_database
from superset.commands.dataset.importers.v1.utils import import_dataset
from superset.commands.importers.v1 import ImportModelsCommand
from superset.daos.database import DatabaseDAO
from superset.databases.schemas import ImportV1DatabaseSchema
from superset.datasets.schemas import ImportV1DatasetSchema


class ImportDatabasesCommand(ImportModelsCommand):
    """Import databases"""

    dao = DatabaseDAO
    model_name = "database"
    prefix = "databases/"
    schemas: dict[str, Schema] = {
        "databases/": ImportV1DatabaseSchema(),
        "datasets/": ImportV1DatasetSchema(),
    }
    import_error = DatabaseImportError

    @staticmethod
    def _import(configs: dict[str, Any], overwrite: bool = False) -> None:
        # first import databases
        database_ids: dict[str, int] = {}
        for file_name, config in configs.items():
            if file_name.startswith("databases/"):
                database = import_database(config, overwrite=overwrite)
                database_ids[str(database.uuid)] = database.id

        # import related datasets
        for file_name, config in configs.items():
            if (
                file_name.startswith("datasets/")
                and config["database_uuid"] in database_ids
            ):
                config["database_id"] = database_ids[config["database_uuid"]]
                # overwrite=False prevents deleting any non-imported columns/metrics
                import_dataset(config, overwrite=False)
