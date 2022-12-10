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
from typing import Any, Dict

from superset.commands.base import BaseCommand
from superset.connectors.sqla.models import RowLevelSecurityFilter, SqlaTable
from superset.dao.exceptions import DAOCreateFailedError
from superset.extensions import appbuilder, db, security_manager
from superset.row_level_security.dao import RLSDAO

logger = logging.getLogger(__name__)


class CreateRLSRuleCommand(BaseCommand):
    def __init__(self, data: Dict[str, Any]):
        self._properties = data.copy()

    def run(self) -> Any:
        self.validate()
        try:
            rule = RLSDAO.create(self._properties)
        except DAOCreateFailedError as ex:
            logger.exception(ex.exception)
            raise DAOCreateFailedError

        return rule

    def validate(self) -> None:
        roles = security_manager.find_roles_by_id(self._properties.get("roles", []))
        tables = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.id.in_(self._properties.get("tables", [])))
            .all()
        )
        self._properties["roles"] = roles
        self._properties["tables"] = tables
