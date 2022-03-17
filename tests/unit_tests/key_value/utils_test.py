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

import json
from typing import TYPE_CHECKING
from unittest.mock import patch
from uuid import UUID

if TYPE_CHECKING:
    from superset.key_value.models import KeyValueEntry

import pytest
from flask.ctx import AppContext

from superset.key_value.types import Key

RESOURCE = "my-resource"
UUID_KEY = "3e7a2ab8-bcaf-49b0-a5df-dfb432f291cc"
ID_KEY = "123"


@pytest.fixture
def key_value_entry(app_context: AppContext):
    from superset.key_value.models import KeyValueEntry

    return KeyValueEntry(
        id=int(ID_KEY), uuid=UUID(UUID_KEY), value=json.dumps({"foo": "bar"}),
    )


def test_parse_permalink_key_uuid_valid(app_context: AppContext) -> None:
    from superset.key_value.utils import parse_permalink_key

    assert parse_permalink_key(UUID_KEY) == Key(id=None, uuid=UUID(UUID_KEY))


def test_parse_permalink_key_id_invalid(app_context: AppContext) -> None:
    from superset.key_value.utils import parse_permalink_key

    with pytest.raises(ValueError):
        parse_permalink_key(ID_KEY)


@patch("superset.key_value.utils.current_app.config", {"PERMALINK_KEY_TYPE": "id"})
def test_parse_permalink_key_id_valid(app_context: AppContext) -> None:
    from superset.key_value.utils import parse_permalink_key

    assert parse_permalink_key(ID_KEY) == Key(id=int(ID_KEY), uuid=None)


@patch("superset.key_value.utils.current_app.config", {"PERMALINK_KEY_TYPE": "id"})
def test_parse_permalink_key_uuid_invalid(app_context: AppContext) -> None:
    from superset.key_value.utils import parse_permalink_key

    with pytest.raises(ValueError):
        parse_permalink_key(UUID_KEY)


def test_format_permalink_key_uuid(app_context: AppContext) -> None:
    from superset.key_value.utils import format_permalink_key

    assert format_permalink_key(Key(id=None, uuid=UUID(UUID_KEY))) == UUID_KEY


def test_format_permalink_key_id(app_context: AppContext) -> None:
    from superset.key_value.utils import format_permalink_key

    assert format_permalink_key(Key(id=int(ID_KEY), uuid=None)) == ID_KEY


def test_extract_key_uuid(
    app_context: AppContext, key_value_entry: KeyValueEntry,
) -> None:
    from superset.key_value.utils import extract_key

    assert extract_key(key_value_entry, "id") == ID_KEY


def test_extract_key_id(
    app_context: AppContext, key_value_entry: KeyValueEntry,
) -> None:
    from superset.key_value.utils import extract_key

    assert extract_key(key_value_entry, "uuid") == UUID_KEY


def test_get_filter_uuid(app_context: AppContext,) -> None:
    from superset.key_value.utils import get_filter

    assert get_filter(resource=RESOURCE, key=UUID_KEY, key_type="uuid",) == {
        "resource": RESOURCE,
        "uuid": UUID(UUID_KEY),
    }


def test_get_filter_id(app_context: AppContext,) -> None:
    from superset.key_value.utils import get_filter

    assert get_filter(resource=RESOURCE, key=ID_KEY, key_type="id",) == {
        "resource": RESOURCE,
        "id": int(ID_KEY),
    }
