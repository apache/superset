#  Licensed to the Apache Software Foundation (ASF) under one
#  or more contributor license agreements.  See the NOTICE file
#  distributed with this work for additional information
#  regarding copyright ownership.  The ASF licenses this file
#  to you under the Apache License, Version 2.0 (the
#  "License"); you may not use this file except in compliance
#  with the License.  You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing,
#  software distributed under the License is distributed on an
#  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
#  specific language governing permissions and limitations
#  under the License.
from __future__ import annotations

from typing import TYPE_CHECKING

from superset import feature_flag_manager

from .access_validators import SecurityManagerWrapper, SqlDatabaseBasedAccessValidator
from .impl import QueryContextValidatorImpl, QueryContextValidatorWrapper

if TYPE_CHECKING:
    from superset.datasets.dao import DatasetDAO
    from superset.security.manager import SupersetSecurityManager

    from . import QueryContextValidator


class QueryContextValidatorFactory:  # pylint: disable=too-few-public-methods
    _security_manager: SupersetSecurityManager
    _dataset_dao: DatasetDAO

    def __init__(
        self, security_manager: SupersetSecurityManager, dataset_dao: DatasetDAO
    ):
        self._security_manager = security_manager
        self._dataset_dao = dataset_dao

    def make(self, is_sql_db: bool = False) -> QueryContextValidator:
        if feature_flag_manager.is_feature_enabled(
            "QUERY_CONTEXT_VALIDATION_SQL_EXPRESSION"
        ):
            access_validator = self._make_access_validator(is_sql_db)
            return QueryContextValidatorImpl(access_validator)
        return QueryContextValidatorWrapper()

    def _make_access_validator(self, is_sql_db: bool) -> QueryContextValidator:
        if is_sql_db:
            return SqlDatabaseBasedAccessValidator(
                self._security_manager, self._dataset_dao
            )
        return SecurityManagerWrapper(self._security_manager)
