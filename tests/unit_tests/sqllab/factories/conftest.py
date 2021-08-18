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
from __future__ import annotations
from typing import Type, TYPE_CHECKING
from unittest.mock import Mock

from pytest import fixture


if TYPE_CHECKING:
    from superset.queries.dao import QueryDAO
    from superset.databases.dao import DatabaseDAO


@fixture
def query_dao_class() -> Type[QueryDAO]:
    return Mock()


@fixture
def database_dao_class() -> Type[DatabaseDAO]:
    return Mock()






