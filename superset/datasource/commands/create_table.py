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
import logging
from typing import Optional

from flask import g

from superset import db
from superset.commands.base import BaseCommand
from superset.connectors.sqla.models import SqlaTable
from superset.databases.commands.exceptions import DatabaseNotFoundError
from superset.databases.dao import DatabaseDAO
from superset.datasource.commands.exceptions import GetTableFromDatabaseFailedError
from superset.models.core import Database
from superset.views.base import create_table_permissions

logger = logging.getLogger(__name__)


class CreateSqlaTableCommand(BaseCommand):
    def __init__(
        self,
        table_name: str,
        database_id: int,
        schema: Optional[str] = None,
        template_params: Optional[str] = None,
    ):
        self._table_name = table_name
        self._database_id = database_id
        self._schema = schema
        self._template_params = template_params
        self._database: Database = None  # type: ignore

    def run(self) -> SqlaTable:
        self.validate()
        table = SqlaTable(table_name=self._table_name, owners=[g.user])
        table.database = self._database
        table.schema = self._schema
        table.template_params = self._template_params
        db.session.add(table)
        table.fetch_metadata()
        create_table_permissions(table)
        db.session.commit()
        return table

    def validate(self) -> None:
        database = DatabaseDAO.find_by_id(self._database_id)
        if not database:
            raise DatabaseNotFoundError()
        self._database = database
        try:
            self._database.get_table(self._table_name, schema=self._schema)
        except Exception as ex:
            logger.exception(
                "Error getting table %s for database %s",
                self._table_name,
                self._database.id,
            )
            raise GetTableFromDatabaseFailedError() from ex
