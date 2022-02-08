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

from .....common.logger_utils import log
from . import IdService

if TYPE_CHECKING:
    from ...persistence.auto_increment_access_engine import AutoIncrementEngineProvider


@log
class StatelessIdService(IdService):
    _table_name: str
    _auto_increment_value_provider: AutoIncrementEngineProvider

    def __init__(
        self,
        table_name: str,
        auto_increment_value_provider: AutoIncrementEngineProvider,
    ):
        self._table_name = table_name
        self._auto_increment_value_provider = auto_increment_value_provider

    def get_next(self) -> int:
        return self._auto_increment_value_provider.get(self._table_name)
