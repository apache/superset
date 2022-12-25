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

from typing import Any, Dict, Set

from marshmallow import Schema
from sqlalchemy.orm import Session

from superset.commands.importers.v1 import ImportModelsCommand
from superset.databases.commands.importers.v1.utils import import_database
from superset.databases.schemas import ImportV1DatabaseSchema
from superset.datamanage.commands.exceptions import DatamanageImportError
from superset.datamanage.commands.importers.v1.utils import import_datamanage
from superset.datamanage.dao import DatamanageDAO
from superset.datamanage.schemas import ImportV1DatamanageSchema


class ImportDatamanageCommand(ImportModelsCommand):

    """Import Datamanage"""

    dao = DatamanageDAO
    model_name = "datamanage"
    prefix = "datamanage/"
    schemas: Dict[str, Schema] = {
        "databases/": ImportV1DatabaseSchema(),
        "datamanage/": ImportV1DatamanageSchema(),
    }
    import_error = DatamanageImportError

    @staticmethod
    def _import(
        session: Session, configs: Dict[str, Any], overwrite: bool = False
    ) -> None:
        # discover databases associated with datamanage
        database_uuids: Set[str] = set()
        for file_name, config in configs.items():
            if file_name.startswith("datamanage/"):
                database_uuids.add(config["database_uuid"])

        # import related databases
        database_ids: Dict[str, int] = {}
        for file_name, config in configs.items():
            if file_name.startswith("databases/") and config["uuid"] in database_uuids:
                database = import_database(session, config, overwrite=False)
                database_ids[str(database.uuid)] = database.id

        # import datamanage with the correct parent ref
        for file_name, config in configs.items():
            if (
                file_name.startswith("datamanage/")
                and config["database_uuid"] in database_ids
            ):
                config["database_id"] = database_ids[config["database_uuid"]]
                import_datamanage(session, config, overwrite=overwrite)
