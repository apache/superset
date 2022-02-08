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
from abc import ABC, abstractmethod

from sqlalchemy.engine import Engine, ResultProxy

from .....common.logger_utils import log


@log
class AutoIncrementEngineProvider(ABC):
    _engine: Engine

    def __init__(self, engine: Engine):
        self._engine = engine

    def get(self, table_name: str):
        execution_result: ResultProxy = self._engine.execute(
            self._get_statement(table_name)
        )
        rv = execution_result.scalar()
        return rv if rv is not None else 1

    @abstractmethod
    def _get_statement(self, table_name: str):
        ...
