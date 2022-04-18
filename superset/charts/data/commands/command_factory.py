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

from typing import ClassVar, TYPE_CHECKING

from .get_data_command import ChartDataCommand

if TYPE_CHECKING:
    from superset.commands.base import BaseCommand
    from superset.common.query_context import QueryContext

    from ..query_context_validators.validaor_factory import QueryContextValidatorFactory


class GetChartDataCommandFactory:
    _instance: ClassVar[GetChartDataCommandFactory]

    _validator_factory: QueryContextValidatorFactory

    @classmethod
    def init(cls, validator_factory: QueryContextValidatorFactory) -> None:
        cls._instance = GetChartDataCommandFactory(validator_factory)

    def __init__(self, validator_factory: QueryContextValidatorFactory):
        self._validator_factory = validator_factory

    @classmethod
    def make(cls, query_context: QueryContext) -> BaseCommand:
        if cls._instance is None:
            raise RuntimeError("GetChartDataCommandFactory was not initialized")
        return cls._instance._make(query_context)

    def _make(self, query_context: QueryContext) -> BaseCommand:
        validator = self._validator_factory.make(self._is_use_sql_db(query_context))
        return ChartDataCommand(query_context, validator)

    def _is_use_sql_db(  # pylint: disable=no-self-use
        self, query_context: QueryContext
    ) -> bool:
        return query_context.datasource.type == "table"
