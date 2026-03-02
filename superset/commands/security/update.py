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
from functools import partial
from typing import Any, Optional

from marshmallow import ValidationError

from superset.commands.base import BaseCommand
from superset.commands.exceptions import DatasourceNotFoundValidationError
from superset.commands.security.exceptions import (
    RLSRuleInvalidError,
    RLSRuleNotFoundError,
    RLSRuleUpdateFailedError,
)
from superset.commands.utils import populate_roles
from superset.connectors.sqla.models import RowLevelSecurityFilter, SqlaTable
from superset.daos.dataset import DatasetDAO
from superset.daos.security import RLSDAO
from superset.exceptions import SupersetParseError, SupersetSecurityException
from superset.models.helpers import validate_rls_clause
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class UpdateRLSRuleCommand(BaseCommand):
    def __init__(self, model_id: int, data: dict[str, Any]):
        self._model_id = model_id
        self._properties = data.copy()
        self._tables = self._properties.get("tables", [])
        self._roles = self._properties.get("roles", [])
        self._model: Optional[RowLevelSecurityFilter] = None

    @transaction(on_error=partial(on_error, reraise=RLSRuleUpdateFailedError))
    def run(self) -> Any:
        self.validate()
        assert self._model
        return RLSDAO.update(self._model, self._properties)

    def validate(self) -> None:
        exceptions: list[ValidationError] = []

        self._model = RLSDAO.find_by_id(int(self._model_id))
        if not self._model:
            raise RLSRuleNotFoundError()

        roles = populate_roles(self._roles)

        # If tables are provided in payload, use them.
        # Otherwise, use the tables currently associated with the model.
        if "tables" in self._properties:
            tables: list[SqlaTable] = DatasetDAO.find_by_ids(self._tables)
            if len(tables) != len(self._tables):
                exceptions.append(DatasourceNotFoundValidationError())
        else:
            tables = self._model.tables

        self._properties["roles"] = roles
        if clause := self._properties.get("clause"):
            if not tables:
                try:
                    validate_rls_clause(clause, engine="base")
                except (SupersetSecurityException, SupersetParseError) as ex:
                    exceptions.append(ValidationError(ex.message))
            for table in tables:
                try:
                    validate_rls_clause(
                        clause,
                        engine=table.database.db_engine_spec.engine,
                    )
                except (SupersetSecurityException, SupersetParseError) as ex:
                    exceptions.append(ValidationError(ex.message))

        if exceptions:
            raise RLSRuleInvalidError(exceptions=exceptions)

        self._properties["tables"] = tables
