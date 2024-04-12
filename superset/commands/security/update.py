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
from typing import Any, Optional

from superset.commands.base import BaseCommand
from superset.commands.exceptions import DatasourceNotFoundValidationError
from superset.commands.security.exceptions import RLSRuleNotFoundError
from superset.commands.utils import populate_roles
from superset.connectors.sqla.models import RowLevelSecurityFilter, SqlaTable
from superset.daos.exceptions import DAOUpdateFailedError
from superset.daos.security import RLSDAO
from superset.extensions import db

logger = logging.getLogger(__name__)


class UpdateRLSRuleCommand(BaseCommand):
    def __init__(self, model_id: int, data: dict[str, Any]):
        self._model_id = model_id
        self._properties = data.copy()
        self._tables = self._properties.get("tables", [])
        self._roles = self._properties.get("roles", [])
        self._model: Optional[RowLevelSecurityFilter] = None

    def run(self) -> Any:
        self.validate()
        assert self._model

        try:
            rule = RLSDAO.update(self._model, self._properties)
        except DAOUpdateFailedError as ex:
            logger.exception(ex.exception)
            raise ex

        return rule

    def validate(self) -> None:
        self._model = RLSDAO.find_by_id(int(self._model_id))
        if not self._model:
            raise RLSRuleNotFoundError()
        roles = populate_roles(self._roles)
        tables = (
            db.session.query(SqlaTable).filter(SqlaTable.id.in_(self._tables)).all()
        )
        if len(tables) != len(self._tables):
            raise DatasourceNotFoundValidationError()
        self._properties["roles"] = roles
        self._properties["tables"] = tables
