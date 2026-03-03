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

from superset import db
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
        from flask_babel import lazy_gettext as _

        from superset.connectors.sqla.models import RowLevelSecurityFilter

        exceptions: list[ValidationError] = []
        self._model = RLSDAO.find_by_id(int(self._model_id))
        if not self._model:
            raise RLSRuleNotFoundError()

        if name := self._properties.get("name"):
            model_with_name = (
                db.session.query(RowLevelSecurityFilter)
                .filter_by(name=name)
                .one_or_none()
            )
            if model_with_name and model_with_name.id != int(self._model_id):
                exceptions.append(
                    ValidationError(_("Name must be unique"), field_name="name")
                )

        roles = populate_roles(self._roles)

        # If tables are provided in payload, use them.
        # Otherwise, use the tables currently associated with the model.
        if "tables" in self._properties:
            tables: list[SqlaTable] = DatasetDAO.find_by_ids(self._tables)
            if len(tables) != len(self._tables):
                raise DatasourceNotFoundValidationError()
        else:
            tables = self._model.tables

        if exceptions:
            raise RLSRuleInvalidError(exceptions=exceptions)

        self._properties["roles"] = roles
        if clause := self._properties.get("clause"):
            if not tables:
                validate_rls_clause(clause, engine="base")
            for table in tables:
                validate_rls_clause(
                    clause,
                    engine=table.database.db_engine_spec.engine,
                )

        self._properties["tables"] = tables
