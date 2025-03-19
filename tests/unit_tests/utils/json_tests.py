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
import copy
import datetime
import math
from unittest.mock import MagicMock

import pytest

from superset.utils import json


def test_json_loads():
    serialized_data = (
        '{"str": "Hello World", "int": 123456789, "float": 0.12345, "bool": true}'
    )
    data = json.loads(serialized_data)
    assert data["str"] == "Hello World"
    assert data["int"] == 123456789
    assert data["float"] == 0.12345
    assert data["bool"] is True


def test_json_loads_exception():
    invalid = '{"a": 5, "b": [1, 5, ["g", "h]]}'
    with pytest.raises(json.JSONDecodeError) as excinfo:
        json.loads(invalid)
    assert (
        str(excinfo.value)
        == "Unterminated string starting at: line 1 column 28 (char 27)"
    )


def test_json_loads_encoding():
    unicode_data = b'{"a": "\u0073\u0074\u0072"}'
    data = json.loads(unicode_data)
    assert data["a"] == "str"
    utf16_data = b'\xff\xfe{\x00"\x00a\x00"\x00:\x00 \x00"\x00s\x00t\x00r\x00"\x00}\x00'
    data = json.loads(utf16_data, encoding="utf-16")
    assert data["a"] == "str"


def test_json_loads_allow_nan():
    serialized_data = '{"float": NaN}'
    with pytest.raises(json.JSONDecodeError) as excinfo:
        json.loads(serialized_data)
    assert str(excinfo.value) == "Expecting value: line 1 column 11 (char 10)"
    data = json.loads(serialized_data, allow_nan=True)
    assert isinstance(data, object)
    assert math.isnan(data["float"]) is True


def test_json_dumps():
    data = {
        "str": "Hello World",
        "int": 123456789,
        "float": 0.12345,
        "bool": True,
    }
    json_str = json.dumps(data, default=json.pessimistic_json_iso_dttm_ser)
    reloaded_data = json.loads(json_str)
    assert reloaded_data["str"] == "Hello World"
    assert reloaded_data["int"] == 123456789
    assert reloaded_data["float"] == 0.12345
    assert reloaded_data["bool"] is True


def test_json_dumps_encoding():
    data = {
        "utf8": b"Hello World",
        "utf16": b"\xff\xfeH\x00e\x00l\x00l\x00o\x00 \x00W\x00o\x00r\x00l\x00d\x00",
        "bytes": b"\xff",
    }
    json_str = json.dumps(data, default=json.pessimistic_json_iso_dttm_ser)
    reloaded_data = json.loads(json_str)
    assert reloaded_data["utf8"] == "Hello World"
    assert reloaded_data["utf16"] == "Hello World"
    assert reloaded_data["bytes"] == "[bytes]"


def test_json_iso_dttm_ser():
    data = {
        "datetime": datetime.datetime(2021, 1, 1, 0, 0, 0),
        "date": datetime.date(2021, 1, 1),
    }
    json_str = json.dumps(data, default=json.json_iso_dttm_ser)
    reloaded_data = json.loads(json_str)
    assert reloaded_data["datetime"] == "2021-01-01T00:00:00"
    assert reloaded_data["date"] == "2021-01-01"


def test_pessimistic_json_iso_dttm_ser():
    data = {
        "datetime": datetime.datetime(2021, 1, 1, 0, 0, 0),
        "date": datetime.date(2021, 1, 1),
    }
    json_str = json.dumps(data, default=json.pessimistic_json_iso_dttm_ser)
    reloaded_data = json.loads(json_str)
    assert reloaded_data["datetime"] == "2021-01-01T00:00:00"
    assert reloaded_data["date"] == "2021-01-01"
    with pytest.raises(TypeError) as excinfo:
        json.dumps({"UNSERIALIZABLE": MagicMock()})
    assert str(excinfo.value) == "_asdict() must return a dict, not MagicMock"


def test_pessimistic_json_iso_dttm_ser_nonutf8():
    data = {
        "INVALID_UTF8_BYTES": b"\xff",
    }
    assert isinstance(data["INVALID_UTF8_BYTES"], bytes)
    json_str = json.dumps(data, default=json.pessimistic_json_iso_dttm_ser)
    reloaded_data = json.loads(json_str)
    assert reloaded_data["INVALID_UTF8_BYTES"] == "[bytes]"


def test_pessimistic_json_iso_dttm_ser_utf16():
    data = {
        "VALID_UTF16_BYTES": b"\xff\xfeS0\x930k0a0o0\x16NLu",
    }
    assert isinstance(data["VALID_UTF16_BYTES"], bytes)
    json_str = json.dumps(data, default=json.pessimistic_json_iso_dttm_ser)
    reloaded_data = json.loads(json_str)
    assert reloaded_data["VALID_UTF16_BYTES"] == "こんにちは世界"


def test_validate_json():
    valid = '{"a": 5, "b": [1, 5, ["g", "h"]]}'
    assert json.validate_json(valid) is None
    invalid = '{"a": 5, "b": [1, 5, ["g", "h]]}'
    with pytest.raises(json.JSONDecodeError) as excinfo:
        json.validate_json(invalid)
    assert (
        str(excinfo.value)
        == "Unterminated string starting at: line 1 column 28 (char 27)"
    )


def test_sensitive_fields() -> None:
    """
    Test masking/unmasking of sensitive fields.
    """
    payload = {
        "password": "SECRET",
        "credentials": {
            "user_id": "alice",
            "user_token": "TOKEN",
        },
    }
    sensitive_fields = {"$.password", "$.credentials.user_token"}

    redacted_payload = json.redact_sensitive(payload, sensitive_fields)
    assert redacted_payload == {
        "password": "XXXXXXXXXX",
        "credentials": {
            "user_id": "alice",
            "user_token": "XXXXXXXXXX",
        },
    }

    new_payload = copy.deepcopy(redacted_payload)
    new_payload["credentials"]["user_id"] = "bob"

    assert json.reveal_sensitive(payload, new_payload, sensitive_fields) == {
        "password": "SECRET",
        "credentials": {
            "user_id": "bob",
            "user_token": "TOKEN",
        },
    }

    new_payload = copy.deepcopy(redacted_payload)
    new_payload["credentials"]["user_token"] = "NEW_TOKEN"

    assert json.reveal_sensitive(payload, new_payload, sensitive_fields) == {
        "password": "SECRET",
        "credentials": {
            "user_id": "alice",
            "user_token": "NEW_TOKEN",
        },
    }
