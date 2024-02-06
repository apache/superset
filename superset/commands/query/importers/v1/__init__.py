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
from sqlalchemy.orm import Session

from superset.commands.database.importers.v1.utils import import_database
from superset.commands.importers.v1 import ImportModelsCommand
from superset.commands.query.exceptions import SavedQueryImportError
from superset.commands.query.importers.v1.utils import import_saved_query
from superset.connectors.sqla.models import SqlaTable
from superset.daos.query import SavedQueryDAO
from superset.databases.schemas import ImportV1DatabaseSchema
from superset.queries.saved_queries.schemas import ImportV1SavedQuerySchema


class ImportSavedQueriesCommand(ImportModelsCommand):
    """Import Saved Queries"""

    dao = SavedQueryDAO
    model_name = "saved_queries"
    prefix = "queries/"
    schemas: dict[str, Schema] = {
        "databases/": ImportV1DatabaseSchema(),
        "queries/": ImportV1SavedQuerySchema(),
    }
    import_error = SavedQueryImportError

    @staticmethod
    def _import(
        session: Session, configs: dict[str, Any], overwrite: bool = False
    ) -> None:
        # discover databases associated with saved queries
        database_uuids: set[str] = set()
        for file_name, config in configs.items():
            if file_name.startswith("queries/"):
                database_uuids.add(config["database_uuid"])

        # import related databases
        database_ids: dict[str, int] = {}
        for file_name, config in configs.items():
            if file_name.startswith("databases/") and config["uuid"] in database_uuids:
                database = import_database(session, config, overwrite=False)
                database_ids[str(database.uuid)] = database.id

        # import saved queries with the correct parent ref
        for file_name, config in configs.items():
            if (
                file_name.startswith("queries/")
                and config["database_uuid"] in database_ids
            ):
                config["db_id"] = database_ids[config["database_uuid"]]
                import_saved_query(session, config, overwrite=overwrite)
