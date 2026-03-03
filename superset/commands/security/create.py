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
from typing import Any

from marshmallow import ValidationError

from superset import db
from superset.commands.base import BaseCommand
from superset.commands.exceptions import DatasourceNotFoundValidationError
from superset.commands.security.exceptions import (
    RLSRuleCreateFailedError,
    RLSRuleInvalidError,
)
from superset.commands.utils import populate_roles
from superset.connectors.sqla.models import SqlaTable
from superset.daos.dataset import DatasetDAO
from superset.daos.security import RLSDAO
from superset.models.helpers import validate_rls_clause
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CreateRLSRuleCommand(BaseCommand):
    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()
        self._tables = self._properties.get("tables", [])
        self._roles = self._properties.get("roles", [])

    @transaction(on_error=partial(on_error, reraise=RLSRuleCreateFailedError))
    def run(self) -> Any:
        self.validate()
        return RLSDAO.create(attributes=self._properties)

    def validate(self) -> None:
        from flask_babel import lazy_gettext as _

        from superset.connectors.sqla.models import RowLevelSecurityFilter

        exceptions: list[ValidationError] = []
        if name := self._properties.get("name"):
            if (
                db.session.query(RowLevelSecurityFilter)
                .filter_by(name=name)
                .one_or_none()
            ):
                exceptions.append(
                    ValidationError(_("Name must be unique"), field_name="name")
                )

        roles = populate_roles(self._roles)
        tables: list[SqlaTable] = DatasetDAO.find_by_ids(self._tables)

        if len(tables) != len(self._tables):
            raise DatasourceNotFoundValidationError()

        if exceptions:
            raise RLSRuleInvalidError(exceptions=exceptions)

        self._properties["roles"] = roles
        if clause := self._properties.get("clause"):
            # If no tables are associated, perform a baseline check
            if not tables:
                validate_rls_clause(clause, engine="base")

            for table in tables:
                validate_rls_clause(
                    clause,
                    engine=table.database.db_engine_spec.engine,
                )

        self._properties["tables"] = tables
