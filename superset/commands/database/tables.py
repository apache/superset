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

from __future__ import annotations

import logging
from typing import Any, cast

from sqlalchemy.orm import lazyload, load_only

from superset.commands.base import BaseCommand
from superset.commands.database.exceptions import (
    DatabaseNotFoundError,
    DatabaseTablesUnexpectedError,
)
from superset.connectors.sqla.models import SqlaTable
from superset.daos.database import DatabaseDAO
from superset.exceptions import SupersetException
from superset.extensions import db, security_manager
from superset.models.core import Database

logger = logging.getLogger(__name__)


class TablesDatabaseCommand(BaseCommand):
    _model: Database

    def __init__(
        self,
        db_id: int,
        catalog_name: str | None,
        schema_name: str,
        force: bool,
    ):
        self._db_id = db_id
        self._catalog_name = catalog_name
        self._schema_name = schema_name
        self._force = force

    def run(self) -> dict[str, Any]:
        self.validate()
        try:
            tables = security_manager.get_datasources_accessible_by_user(
                database=self._model,
                catalog=self._catalog_name,
                schema=self._schema_name,
                datasource_names=sorted(
                    self._model.get_all_table_names_in_schema(
                        catalog=self._catalog_name,
                        schema=self._schema_name,
                        force=self._force,
                        cache=self._model.table_cache_enabled,
                        cache_timeout=self._model.table_cache_timeout,
                    )
                ),
            )

            views = security_manager.get_datasources_accessible_by_user(
                database=self._model,
                catalog=self._catalog_name,
                schema=self._schema_name,
                datasource_names=sorted(
                    self._model.get_all_view_names_in_schema(
                        catalog=self._catalog_name,
                        schema=self._schema_name,
                        force=self._force,
                        cache=self._model.table_cache_enabled,
                        cache_timeout=self._model.table_cache_timeout,
                    )
                ),
            )

            extra_dict_by_name = {
                table.name: table.extra_dict
                for table in (
                    db.session.query(SqlaTable)
                    .filter(
                        SqlaTable.database_id == self._model.id,
                        SqlaTable.catalog == self._catalog_name,
                        SqlaTable.schema == self._schema_name,
                    )
                    .options(
                        load_only(
                            SqlaTable.catalog,
                            SqlaTable.schema,
                            SqlaTable.table_name,
                            SqlaTable.extra,
                        ),
                        lazyload(SqlaTable.columns),
                        lazyload(SqlaTable.metrics),
                    )
                ).all()
            }

            options = sorted(
                [
                    {
                        "value": table.table,
                        "type": "table",
                        "extra": extra_dict_by_name.get(table.table, None),
                    }
                    for table in tables
                ]
                + [
                    {
                        "value": view.table,
                        "type": "view",
                    }
                    for view in views
                ],
                key=lambda item: item["value"],
            )

            payload = {"count": len(tables) + len(views), "result": options}
            return payload
        except SupersetException:
            raise
        except Exception as ex:
            raise DatabaseTablesUnexpectedError(str(ex)) from ex

    def validate(self) -> None:
        self._model = cast(Database, DatabaseDAO.find_by_id(self._db_id))
        if not self._model:
            raise DatabaseNotFoundError()
