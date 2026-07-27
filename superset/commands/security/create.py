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
from typing import Any

from marshmallow import ValidationError

from superset.commands.base import BaseCommand
from superset.commands.exceptions import DatasourceNotFoundValidationError
from superset.commands.security.utils import raise_for_datasource_access
from superset.commands.utils import populate_subject_list
from superset.connectors.sqla.models import SqlaTable
from superset.daos.security import RLSDAO
from superset.extensions import db
from superset.utils.core import RowLevelSecurityFilterType
from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)


class CreateRLSRuleCommand(BaseCommand):
    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()
        self._tables = self._properties.get("tables", [])
        self._subjects = self._properties.get("subjects", [])

    @transaction()
    def run(self) -> Any:
        self.validate()
        return RLSDAO.create(attributes=self._properties)

    def validate(self) -> None:
        if (
            self._properties.get("filter_type")
            == RowLevelSecurityFilterType.REGULAR.value
            and not self._subjects
        ):
            raise ValidationError(
                {"subjects": ["Regular RLS filters require at least one subject."]}
            )

        if self._subjects:
            subjects = populate_subject_list(
                self._subjects,
                default_to_user=False,
            )
            self._properties["subjects"] = subjects

        tables = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.id.in_(self._tables))  # type: ignore[attr-defined]
            .all()
        )
        if len(tables) != len(self._tables):
            raise DatasourceNotFoundValidationError()
        raise_for_datasource_access(tables)
        self._properties["tables"] = tables
