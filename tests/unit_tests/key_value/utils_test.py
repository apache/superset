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

import pickle
from typing import TYPE_CHECKING
from uuid import UUID

if TYPE_CHECKING:
    from superset.key_value.models import KeyValueEntry

import pytest
from flask.ctx import AppContext

from superset.key_value.types import Key

RESOURCE = "my-resource"
UUID_KEY = UUID("3e7a2ab8-bcaf-49b0-a5df-dfb432f291cc")
ID_KEY = 123


def test_get_filter_uuid(app_context: AppContext) -> None:
    from superset.key_value.utils import get_filter

    assert get_filter(resource=RESOURCE, key=UUID_KEY) == {
        "resource": RESOURCE,
        "uuid": UUID_KEY,
    }


def test_get_filter_id(app_context: AppContext) -> None:
    from superset.key_value.utils import get_filter

    assert get_filter(resource=RESOURCE, key=ID_KEY) == {
        "resource": RESOURCE,
        "id": ID_KEY,
    }
