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

import json
from typing import Any, Dict

from marshmallow import fields, Schema
from sqlalchemy.orm import Session

from superset.commands.importers.v1 import ImportModelsCommand
from superset.models.core import Database


class DatabaseExtraSchema(Schema):
    metadata_params = fields.Dict(keys=fields.Str(), values=fields.Raw())
    engine_params = fields.Dict(keys=fields.Str(), values=fields.Raw())
    metadata_cache_timeout = fields.Dict(keys=fields.Str(), values=fields.Integer())
    schemas_allowed_for_csv_upload = fields.List(fields.String)


class DatabaseSchema(Schema):
    database_name = fields.String(required=True)
    sqlalchemy_uri = fields.String(required=True)
    cache_timeout = fields.Integer(allow_none=True)
    expose_in_sqllab = fields.Boolean()
    allow_run_async = fields.Boolean()
    allow_ctas = fields.Boolean()
    allow_cvas = fields.Boolean()
    allow_csv_upload = fields.Boolean()
    extra = fields.Nested(DatabaseExtraSchema)
    uuid = fields.UUID(required=True)
    version = fields.String(required=True)


class ImportDatabasesCommand(ImportModelsCommand):
    """
    Import databases.
    """

    model = Database
    schema = DatabaseSchema
    prefix = "databases/"

    @staticmethod
    def import_(
        session: Session, config: Dict[str, Any], overwrite: bool = False
    ) -> Database:
        existing = session.query(Database).filter_by(uuid=config["uuid"]).first()
        if existing:
            if not overwrite:
                return existing
            config["id"] = existing.id

        # TODO (betodealmeida): move this logic to import_from_dict
        config["extra"] = json.dumps(config["extra"])

        database = Database.import_from_dict(session, config, recursive=False)
        if database.id is None:
            session.flush()

        return database

    def import_bundle(self, session: Session) -> None:
        from superset.datasets.commands.importers.v1 import ImportDatasetsCommand

        database_ids: Dict[str, int] = {}
        for file_name, config in self._configs.items():
            if file_name.startswith(self.prefix):
                database = self.import_(session, config, overwrite=True)
                database_ids[str(database.uuid)] = database.id

        # import related datasets
        for file_name, config in self._configs.items():
            if (
                file_name.startswith(ImportDatasetsCommand.prefix)
                and config["database_uuid"] in database_ids
            ):
                config["database_id"] = database_ids[config["database_uuid"]]
                # overwrite=False prevents deleting any non-imported columns/metrics
                ImportDatasetsCommand.import_(session, config, overwrite=False)

    def validate(self) -> None:
        from superset.datasets.commands.importers.v1 import ImportDatasetsCommand

        super().validate()

        # also validate datasets
        for file_name, config in self._configs.items():
            if file_name.startswith(ImportDatasetsCommand.prefix):
                ImportDatasetsCommand.validate_schema(config)
