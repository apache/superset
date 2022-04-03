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

from uuid import UUID

import pytest

from superset.key_value.exceptions import KeyValueParseKeyError
from superset.key_value.types import KeyValueResource

RESOURCE = KeyValueResource.APP
UUID_KEY = UUID("3e7a2ab8-bcaf-49b0-a5df-dfb432f291cc")
ID_KEY = 123


def test_get_filter_uuid() -> None:
    from superset.key_value.utils import get_filter

    assert get_filter(resource=RESOURCE, key=UUID_KEY) == {
        "resource": RESOURCE,
        "uuid": UUID_KEY,
    }


def test_get_filter_id() -> None:
    from superset.key_value.utils import get_filter

    assert get_filter(resource=RESOURCE, key=ID_KEY) == {
        "resource": RESOURCE,
        "id": ID_KEY,
    }


def test_encode_permalink_id_valid() -> None:
    from superset.key_value.utils import encode_permalink_key

    salt = "abc"
    assert encode_permalink_key(1, salt) == "AyBn4lm9qG8"


def test_decode_permalink_id_invalid() -> None:
    from superset.key_value.utils import decode_permalink_id

    with pytest.raises(KeyValueParseKeyError):
        decode_permalink_id("foo", "bar")
