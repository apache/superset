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
import datetime
import json
from unittest.mock import MagicMock

import pytest

from superset.exceptions import SupersetException
from superset.utils.json import (
    dumps,
    json_iso_dttm_ser,
    pessimistic_json_iso_dttm_ser,
    validate_json,
)


def test_json_dumps():
    data = {
        "str": "some string",
        "int": 123456789,
        "float": 0.12345,
        "bool": True,
    }
    json_str = dumps(data, default=pessimistic_json_iso_dttm_ser)
    reloaded_data = json.loads(json_str)
    assert reloaded_data["str"] == "some string"
    assert reloaded_data["int"] == 123456789
    assert reloaded_data["float"] == 0.12345
    assert reloaded_data["bool"] is True


def test_json_dumps_encoding():
    data = {
        "utf8": b"Hello World",
        "utf16": b"\xff\xfeH\x00e\x00l\x00l\x00o\x00 \x00W\x00o\x00r\x00l\x00d\x00",
        "bytes": b"\xff",
    }
    json_str = dumps(data, default=pessimistic_json_iso_dttm_ser)
    reloaded_data = json.loads(json_str)
    assert reloaded_data["utf8"] == "Hello World"
    assert reloaded_data["utf16"] == "Hello World"
    assert reloaded_data["bytes"] == "[bytes]"


def test_json_iso_dttm_ser():
    data = {
        "datetime": datetime.datetime(2021, 1, 1, 0, 0, 0),
        "date": datetime.date(2021, 1, 1),
    }
    json_str = json.dumps(data, default=json_iso_dttm_ser)
    reloaded_data = json.loads(json_str)
    assert reloaded_data["datetime"] == "2021-01-01T00:00:00"
    assert reloaded_data["date"] == "2021-01-01"


def test_pessimistic_json_iso_dttm_ser():
    data = {
        "datetime": datetime.datetime(2021, 1, 1, 0, 0, 0),
        "date": datetime.date(2021, 1, 1),
        "UNSERIALIZABLE": MagicMock(),
    }
    json_str = json.dumps(data, default=pessimistic_json_iso_dttm_ser)
    reloaded_data = json.loads(json_str)
    assert reloaded_data["datetime"] == "2021-01-01T00:00:00"
    assert reloaded_data["date"] == "2021-01-01"
    assert (
        reloaded_data["UNSERIALIZABLE"]
        == "Unserializable [<class 'unittest.mock.MagicMock'>]"
    )


def test_pessimistic_json_iso_dttm_ser_nonutf8():
    data = {
        "INVALID_UTF8_BYTES": b"\xff",
    }
    assert isinstance(data["INVALID_UTF8_BYTES"], bytes)
    json_str = json.dumps(data, default=pessimistic_json_iso_dttm_ser)
    reloaded_data = json.loads(json_str)
    assert reloaded_data["INVALID_UTF8_BYTES"] == "[bytes]"


def test_pessimistic_json_iso_dttm_ser_utf16():
    data = {
        "VALID_UTF16_BYTES": b"\xff\xfeS0\x930k0a0o0\x16NLu",
    }
    assert isinstance(data["VALID_UTF16_BYTES"], bytes)
    json_str = json.dumps(data, default=pessimistic_json_iso_dttm_ser)
    reloaded_data = json.loads(json_str)
    assert reloaded_data["VALID_UTF16_BYTES"] == "こんにちは世界"


def test_validate_json():
    valid = '{"a": 5, "b": [1, 5, ["g", "h"]]}'
    assert validate_json(valid) is None

    invalid = '{"a": 5, "b": [1, 5, ["g", "h]]}'
    with pytest.raises(SupersetException) as excinfo:
        validate_json(invalid)
    assert str(excinfo.value) == "JSON is not valid"
