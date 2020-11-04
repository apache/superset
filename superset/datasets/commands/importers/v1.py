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

from marshmallow import fields, Schema
from sqlalchemy.orm import Session

from superset.commands.importers.v1 import ImportModelsCommand
from superset.connectors.sqla.models import SqlaTable


class ColumnSchema(Schema):
    column_name = fields.String(required=True)
    verbose_name = fields.String()
    is_dttm = fields.Boolean()
    is_active = fields.Boolean(allow_none=True)
    type = fields.String(required=True)
    groupby = fields.Boolean()
    filterable = fields.Boolean()
    expression = fields.String()
    description = fields.String(allow_none=True)
    python_date_format = fields.String(allow_none=True)


class MetricSchema(Schema):
    metric_name = fields.String(required=True)
    verbose_name = fields.String()
    metric_type = fields.String(allow_none=True)
    expression = fields.String(required=True)
    description = fields.String(allow_none=True)
    d3format = fields.String(allow_none=True)
    extra = fields.String(allow_none=True)
    warning_text = fields.String(allow_none=True)


class DatasetSchema(Schema):
    table_name = fields.String(required=True)
    main_dttm_col = fields.String(allow_none=True)
    description = fields.String()
    default_endpoint = fields.String()
    offset = fields.Integer()
    cache_timeout = fields.Integer()
    schema = fields.String()
    sql = fields.String()
    params = fields.String(allow_none=True)
    template_params = fields.String(allow_none=True)
    filter_select_enabled = fields.Boolean()
    fetch_values_predicate = fields.String(allow_none=True)
    extra = fields.String(allow_none=True)
    uuid = fields.UUID(required=True)
    columns = fields.List(fields.Nested(ColumnSchema))
    metrics = fields.List(fields.Nested(MetricSchema))
    version = fields.String(required=True)
    database_uuid = fields.UUID(required=True)


class ImportDatasetsCommand(ImportModelsCommand):

    model = SqlaTable
    schema = DatasetSchema
    prefix = "datasets/"

    @staticmethod
    def import_(
        session: Session, config: Dict[str, Any], overwrite: bool = False,
    ) -> SqlaTable:
        existing = session.query(SqlaTable).filter_by(uuid=config["uuid"]).first()
        if existing:
            if not overwrite:
                return existing
            config["id"] = existing.id

        # should we delete columns and metrics not present in the current import?
        sync = ["columns", "metrics"] if overwrite else []

        # import recursively to include columns and metrics
        dataset = SqlaTable.import_from_dict(session, config, recursive=True, sync=sync)
        if dataset.id is None:
            session.flush()

        return dataset

    def import_bundle(self, session: Session) -> None:
        from superset.databases.commands.importers.v1 import ImportDatabasesCommand

        # discover databases associated with datasets
        database_uuids: Set[str] = set()
        for file_name, config in self._configs.items():
            if file_name.startswith(self.prefix):
                database_uuids.add(config["database_uuid"])

        # import related databases
        database_ids: Dict[str, int] = {}
        for file_name, config in self._configs.items():
            if (
                file_name.startswith(ImportDatabasesCommand.prefix)
                and config["uuid"] in database_uuids
            ):
                database = ImportDatabasesCommand.import_(
                    session, config, overwrite=False
                )
                database_ids[str(database.uuid)] = database.id

        # import datasets with the correct parent ref
        for file_name, config in self._configs.items():
            if (
                file_name.startswith(self.prefix)
                and config["database_uuid"] in database_ids
            ):
                config["database_id"] = database_ids[config["database_uuid"]]
                self.import_(session, config, overwrite=True)

    def validate(self) -> None:
        from superset.databases.commands.importers.v1 import ImportDatabasesCommand

        super().validate()

        # also validate databases
        for file_name, config in self._configs.items():
            if file_name.startswith(ImportDatabasesCommand.prefix):
                ImportDatabasesCommand.validate_schema(config)
