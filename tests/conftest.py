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

import logging
from typing import Any, Callable, Dict, TYPE_CHECKING
from unittest.mock import MagicMock, Mock, PropertyMock

from pytest import fixture

from .consts import BACKEND_PROPERTY_VALUE, SIMULATOR_FIXTURE_SCOPE
from .fixtures import *

if TYPE_CHECKING:
    from superset.models.core import Database

    ExampleDbSupplier = Callable[[], Database]

PRESTO = "presto"
BACKEND_PROPERTY_VALUE = "sqlite"


@fixture(scope="session", autouse=True)
def setup_logging() -> None:
    logging.getLogger("tests").setLevel(logging.DEBUG)


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def example_db_provider() -> ExampleDbSupplier:
    def mock_provider() -> Mock:
        mock = MagicMock()
        type(mock).backend = PropertyMock(return_value=BACKEND_PROPERTY_VALUE)
        return mock

    return mock_provider


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def app_configurations() -> Dict[str, Any]:
    return {"row_limit": 10}
