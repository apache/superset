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
import base64
import copy
import math
import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Any
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest
import pytz
from freezegun import freeze_time

from superset.constants import PASSWORD_MASK
from superset.utils import json
from superset.utils.core import (
    zlib_compress,
    zlib_decompress,
)


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
    unicode_data = rb'{"a": "\u0073\u0074\u0072"}'
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
        "datetime": datetime(2021, 1, 1, 0, 0, 0),
        "date": date(2021, 1, 1),
        "dttm": datetime(2020, 1, 1),
        "dt": date(2020, 1, 1),
        "t": time(),
    }

    json_str = json.dumps(data, default=json.json_iso_dttm_ser)
    reloaded_data = json.loads(json_str)
    assert reloaded_data["datetime"] == "2021-01-01T00:00:00"
    assert reloaded_data["date"] == "2021-01-01"
    assert reloaded_data["dttm"] == "2020-01-01T00:00:00"
    assert reloaded_data["dt"] == "2020-01-01"
    assert reloaded_data["t"] == "00:00:00"
    assert json.json_iso_dttm_ser(np.int64(1)) == 1

    assert (
        json.json_iso_dttm_ser(np.datetime64(), pessimistic=True)
        == "Unserializable [<class 'numpy.datetime64'>]"
    )

    with pytest.raises(TypeError):
        json.json_iso_dttm_ser(np.datetime64())


def test_pessimistic_json_iso_dttm_ser():
    data = {
        "datetime": datetime(2021, 1, 1, 0, 0, 0),
        "date": date(2021, 1, 1),
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
    new_payload["credentials"]["user_token"] = "NEW_TOKEN"  # noqa: S105

    assert json.reveal_sensitive(payload, new_payload, sensitive_fields) == {
        "password": "SECRET",
        "credentials": {
            "user_id": "alice",
            "user_token": "NEW_TOKEN",
        },
    }


def test_base_json_conv():
    assert json.base_json_conv(np.bool_(1)) is True
    assert json.base_json_conv(np.int64(1)) == 1
    assert json.base_json_conv(np.array([1, 2, 3])) == [1, 2, 3]
    assert json.base_json_conv(np.array(None)) is None
    assert json.base_json_conv({1}) == [1]
    assert json.base_json_conv(Decimal("1.0")) == 1.0
    assert isinstance(json.base_json_conv(uuid.uuid4()), str)
    assert json.base_json_conv(time(12, 0)) == "12:00:00"
    assert json.base_json_conv(timedelta(0)) == "0:00:00"
    assert json.base_json_conv(b"") == ""
    assert isinstance(json.base_json_conv(b"\xff\xfe"), str)
    assert json.base_json_conv(pd.DateOffset(days=1)) == "DateOffset(days=1)"
    assert json.base_json_conv(b"\xff") == "[bytes]"

    with pytest.raises(TypeError):
        json.base_json_conv(np.datetime64())


def test_zlib_compression():
    json_str = '{"test": 1}'
    blob = zlib_compress(json_str)
    got_str = zlib_decompress(blob)
    assert json_str == got_str


def test_json_int_dttm_ser():
    dttm = datetime(2020, 1, 1)
    ts = 1577836800000.0
    assert json.json_int_dttm_ser(dttm) == ts
    assert json.json_int_dttm_ser(date(2020, 1, 1)) == ts
    assert json.json_int_dttm_ser(datetime(1970, 1, 1)) == 0
    assert json.json_int_dttm_ser(date(1970, 1, 1)) == 0
    assert json.json_int_dttm_ser(dttm + timedelta(milliseconds=1)) == (ts + 1)

    # Timezone-aware datetime should preserve the absolute instant.
    # 2020-01-01 00:00:00+08:00 == 2019-12-31 16:00:00Z
    dttm_tz = datetime(2020, 1, 1, tzinfo=pytz.FixedOffset(8 * 60))
    assert json.json_int_dttm_ser(dttm_tz) == 1577808000000.0
    assert json.json_int_dttm_ser(np.int64(1)) == 1

    with pytest.raises(TypeError):
        json.json_int_dttm_ser(np.datetime64())


@pytest.mark.parametrize(
    "payload,path_values,expected_result",
    [
        (
            {
                "credentials_info": {
                    "type": "service_account",
                    "private_key": "XXXXXXXXXX",
                },
            },
            {"$.credentials_info.private_key": "NEW_KEY"},
            {
                "credentials_info": {
                    "type": "service_account",
                    "private_key": "NEW_KEY",
                },
            },
        ),
        (
            {
                "auth_params": {
                    "privatekey_body": "XXXXXXXXXX",
                    "privatekey_pass": "XXXXXXXXXX",
                },
                "other": "value",
            },
            {
                "$.auth_params.privatekey_body": "-----BEGIN PRIVATE KEY-----",
                "$.auth_params.privatekey_pass": "passphrase",
            },
            {
                "auth_params": {
                    "privatekey_body": "-----BEGIN PRIVATE KEY-----",
                    "privatekey_pass": "passphrase",
                },
                "other": "value",
            },
        ),
        (
            {"existing": "value"},
            {"$.nonexistent.path": "new_value"},
            {"existing": "value"},
        ),
    ],
)
def test_set_masked_fields(
    payload: dict[str, Any],
    path_values: dict[str, Any],
    expected_result: dict[str, Any],
) -> None:
    """
    Test setting a value at a JSONPath location.
    """
    result = json.set_masked_fields(payload, path_values)
    assert result == expected_result


@pytest.mark.parametrize(
    "payload,sensitive_fields,expected_result",
    [
        (
            {
                "credentials_info": {
                    "type": "service_account",
                    "private_key": PASSWORD_MASK,
                },
            },
            {"$.credentials_info.private_key", "$.credentials_info.type"},
            ["$.credentials_info.private_key"],
        ),
        (
            {
                "credentials_info": {
                    "private_key": "ACTUAL_KEY",
                },
            },
            {"$.credentials_info.private_key"},
            [],
        ),
        (
            {
                "auth_params": {
                    "privatekey_body": PASSWORD_MASK,
                    "privatekey_pass": "actual_pass",
                },
                "oauth2_client_info": {
                    "secret": PASSWORD_MASK,
                },
            },
            {
                "$.auth_params.privatekey_body",
                "$.auth_params.privatekey_pass",
                "$.oauth2_client_info.secret",
            },
            [
                "$.auth_params.privatekey_body",
                "$.oauth2_client_info.secret",
            ],
        ),
        (
            {
                "foo": PASSWORD_MASK,
                "service_account_info": PASSWORD_MASK,
            },
            {"$.*"},
            ["$.foo", "$.service_account_info"],
        ),
        (
            {
                "foo": PASSWORD_MASK,
                "bar": "actual_value",
            },
            {"$.*"},
            ["$.foo"],
        ),
        (
            {
                "foo": "actual_value",
                "bar": "other_value",
            },
            {"$.*"},
            [],
        ),
    ],
)
def test_get_masked_fields(
    payload: dict[str, Any],
    sensitive_fields: set[str],
    expected_result: dict[str, Any],
) -> None:
    """
    Test that get_masked_fields returns paths where value equals PASSWORD_MASK.
    """
    masked = json.get_masked_fields(payload, sensitive_fields)
    assert sorted(masked) == sorted(expected_result)


def test_get_sensitive_field_hints_nested_path() -> None:
    """
    The trailing characters are returned for a nested path.
    """
    payload = {"connect_args": {"scheme": "https", "jwt": "a" * 40 + "ab3d"}}

    assert json.get_sensitive_field_hints(payload, {"$.connect_args.jwt"}, 4) == [
        {
            "path": "$.connect_args.jwt",
            "suffix": "ab3d",
            "expires_at": None,
            "expired": None,
        }
    ]


def test_get_sensitive_field_hints_ignores_non_sensitive_fields() -> None:
    """
    Only the declared sensitive paths are hinted, however long other values are.
    """
    payload = {"connect_args": {"scheme": "https" * 50, "jwt": "x" * 40 + "wxyz"}}

    hints = json.get_sensitive_field_hints(payload, {"$.connect_args.jwt"}, 4)

    assert [hint["path"] for hint in hints] == ["$.connect_args.jwt"]


def test_get_sensitive_field_hints_absent_path() -> None:
    """
    A declared path missing from the payload is not listed.
    """
    assert json.get_sensitive_field_hints({"a": "b"}, {"$.connect_args.jwt"}, 4) == []


@pytest.mark.parametrize(
    "value,suffix",
    [
        ("a" * 19, None),
        ("a" * 15 + "vwxyz", "vwxyz"),
        ("a" * 16 + "vwxyz", "vwxyz"),
        ("short", None),
        ("", None),
    ],
)
def test_get_sensitive_field_hints_never_reveals_more_than_a_quarter(
    value: str, suffix: str | None
) -> None:
    """
    Values shorter than four times the hint length get no suffix.
    """
    hints = json.get_sensitive_field_hints({"secret": value}, {"$.secret"}, 5)

    assert hints == [
        {"path": "$.secret", "suffix": suffix, "expires_at": None, "expired": None}
    ]


def test_get_sensitive_field_hints_withholds_the_length_of_a_short_value() -> None:
    """
    A value too short to reveal gives nothing away, not even its length.
    """
    hints = json.get_sensitive_field_hints({"secret": "short"}, {"$.secret"}, 5)

    assert hints == [
        {"path": "$.secret", "suffix": None, "expires_at": None, "expired": None}
    ]
    assert "length" not in hints[0]


def test_get_sensitive_field_hints_boundary_is_four_times_length() -> None:
    """
    Exactly four times the hint length is the shortest value that gets a suffix.
    """
    below = json.get_sensitive_field_hints({"s": "a" * 7}, {"$.s"}, 2)
    exact = json.get_sensitive_field_hints({"s": "a" * 6 + "zy"}, {"$.s"}, 2)

    assert below[0]["suffix"] is None
    assert exact[0]["suffix"] == "zy"


@pytest.mark.parametrize("value", [None, 12345, True, 1.5, {"nested": "v" * 40}])
def test_get_sensitive_field_hints_skips_non_string_values(value: Any) -> None:
    """
    Only strings are hinted; any other type is skipped without raising.
    """
    assert json.get_sensitive_field_hints({"secret": value}, {"$.secret"}, 4) == []


def test_get_sensitive_field_hints_wildcard_expands_per_match() -> None:
    """
    A wildcard path yields one hint per match, with the concrete path rendered.
    """
    payload = {
        "primary": {"secret": "p" * 20 + "1111"},
        "replica": {"secret": "r" * 20 + "2222"},
        "other": {"secret": 7},
    }

    assert json.get_sensitive_field_hints(payload, {"$.*.secret"}, 4) == [
        {
            "path": "$.primary.secret",
            "suffix": "1111",
            "expires_at": None,
            "expired": None,
        },
        {
            "path": "$.replica.secret",
            "suffix": "2222",
            "expires_at": None,
            "expired": None,
        },
    ]


def test_get_sensitive_field_hints_trims_whitespace() -> None:
    """
    Whitespace is stripped before the suffix is computed.
    """
    value = "\n  " + "a" * 20 + "ab3d" + "  \r\n"

    assert json.get_sensitive_field_hints({"secret": value}, {"$.secret"}, 4) == [
        {
            "path": "$.secret",
            "suffix": "ab3d",
            "expires_at": None,
            "expired": None,
        }
    ]


def test_get_sensitive_field_hints_whitespace_only_value() -> None:
    """
    A blank value never gets a suffix.
    """
    assert json.get_sensitive_field_hints({"secret": "   "}, {"$.secret"}, 4) == [
        {
            "path": "$.secret",
            "suffix": None,
            "expires_at": None,
            "expired": None,
        }
    ]


def test_get_sensitive_field_hints_empty_sensitive_fields() -> None:
    """
    No sensitive paths means no hints.
    """
    assert json.get_sensitive_field_hints({"secret": "a" * 40}, set(), 4) == []


@pytest.mark.parametrize("length", [0, -1])
def test_get_sensitive_field_hints_non_positive_length(length: int) -> None:
    """
    A non-positive hint length yields nothing instead of leaking the whole value.
    """
    assert json.get_sensitive_field_hints({"s": "a" * 40}, {"$.s"}, length) == []


def test_get_sensitive_field_hints_sorted_and_deduplicated() -> None:
    """
    Hints are ordered by path, and overlapping expressions list a path once.
    """
    payload = {"b": "b" * 20, "a": "a" * 20}

    hints = json.get_sensitive_field_hints(payload, {"$.b", "$.*", "$.a"}, 4)

    assert [hint["path"] for hint in hints] == ["$.a", "$.b"]


def _pem(ending: str, newline: str = "\n", size: int = 1_523) -> str:
    """
    A private key in PEM format whose base64 body has ``size`` characters and ends
    with ``ending``, split into 64-character lines joined by ``newline``.
    """
    filler = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7"
    body = (filler * (size // len(filler) + 1))[: size - len(ending)] + ending
    lines = [body[i : i + 64] for i in range(0, len(body), 64)]
    return newline.join(
        ["-----BEGIN PRIVATE KEY-----", *lines, "-----END PRIVATE KEY-----", ""]
    )


def test_get_sensitive_field_hints_pem_suffix_comes_from_the_body() -> None:
    """
    A PEM key reveals the end of its base64 body, not the fixed footer dashes.
    """
    pem = _pem("Ab3dE")

    hints = json.get_sensitive_field_hints({"key": pem}, {"$.key"}, 5)

    assert len(pem.strip()) == 1_600
    assert hints == [
        {
            "path": "$.key",
            "suffix": "Ab3dE",
            "expires_at": None,
            "expired": None,
        }
    ]


@pytest.mark.parametrize("newline", ["\\n", "\r\n", "\\r\\n"])
def test_get_sensitive_field_hints_pem_with_newline_escapes(newline: str) -> None:
    """
    Escaped or CRLF line breaks give the same suffix as real newlines.
    """
    pem = _pem("Ab3dE", newline=newline)

    assert json.get_sensitive_field_hints({"key": pem}, {"$.key"}, 5) == [
        {"path": "$.key", "suffix": "Ab3dE", "expires_at": None, "expired": None}
    ]


@pytest.mark.parametrize("ending", ["Ab3dE=", "Ab3dE=="])
def test_get_sensitive_field_hints_pem_padding_is_not_revealed(ending: str) -> None:
    """
    The base64 padding at the end of a PEM body is not revealed; the suffix ends
    with the last real base64 characters.
    """
    pem = _pem(ending)

    assert json.get_sensitive_field_hints({"key": pem}, {"$.key"}, 5) == [
        {"path": "$.key", "suffix": "Ab3dE", "expires_at": None, "expired": None}
    ]


def test_get_sensitive_field_hints_pem_threshold_ignores_padding() -> None:
    """
    The four-times threshold applies to the PEM body without its padding.
    """
    pem = _pem("Ab3dE==", size=21)

    assert json.get_sensitive_field_hints({"key": pem}, {"$.key"}, 5) == [
        {"path": "$.key", "suffix": None, "expires_at": None, "expired": None}
    ]


def test_get_sensitive_field_hints_pem_rotation_changes_suffix() -> None:
    """
    Two keys that differ only in their body get different suffixes.
    """
    payload = {"old": _pem("Ab3dE"), "new": _pem("Zy9xW")}

    hints = json.get_sensitive_field_hints(payload, {"$.old", "$.new"}, 5)

    assert [hint["suffix"] for hint in hints] == ["Zy9xW", "Ab3dE"]


def test_get_sensitive_field_hints_short_pem_body() -> None:
    """
    A PEM body shorter than four times the hint length reveals nothing, even though
    the whole value with its header and footer is long enough.
    """
    pem = _pem("Ab3dE", size=19)

    assert json.get_sensitive_field_hints({"key": pem}, {"$.key"}, 5) == [
        {
            "path": "$.key",
            "suffix": None,
            "expires_at": None,
            "expired": None,
        }
    ]


@pytest.mark.parametrize(
    "value",
    [
        "token-----" + "a" * 20 + "-----",
        "-----BEGIN PRIVATE KEY-----" + "a" * 20 + "-----END PUBLIC KEY-----",
        "prefix -----BEGIN PRIVATE KEY-----" + "a" * 20 + "-----END PRIVATE KEY-----",
    ],
)
def test_get_sensitive_field_hints_dashes_are_not_a_pem(value: str) -> None:
    """
    A value that only contains dashes, or is not a single PEM block, is plain text.
    """
    assert json.get_sensitive_field_hints({"key": value}, {"$.key"}, 5) == [
        {
            "path": "$.key",
            "suffix": value[-5:],
            "expires_at": None,
            "expired": None,
        }
    ]


def test_get_sensitive_field_paths_dotted_path() -> None:
    """
    A declared nested path is listed when it holds a string.
    """
    payload = {"connect_args": {"scheme": "https", "jwt": "token"}}

    assert json.get_sensitive_field_paths(payload, {"$.connect_args.jwt"}) == [
        "$.connect_args.jwt"
    ]


def test_get_sensitive_field_paths_wildcard_keeps_only_strings() -> None:
    """
    A top-level wildcard lists the string keys only, sorted by path.
    """
    payload = {
        "b_token": "x",
        "connect_args": {"timeout": 5},
        "a_key": "y",
        "port": 3,
        "flag": True,
        "nothing": None,
        "items": ["z"],
    }

    assert json.get_sensitive_field_paths(payload, {"$.*"}) == ["$.a_key", "$.b_token"]


def test_get_sensitive_field_paths_nested_wildcard() -> None:
    """
    A wildcard in the middle of a path yields one concrete path per string match.
    """
    payload = {
        "replica": {"secret": "r"},
        "primary": {"secret": "p"},
        "other": {"secret": 7},
    }

    assert json.get_sensitive_field_paths(payload, {"$.*.secret"}) == [
        "$.primary.secret",
        "$.replica.secret",
    ]


def test_get_sensitive_field_paths_declared_leaf_under_an_object() -> None:
    """
    The wildcard skips an object, while a declared leaf inside it is listed.
    """
    payload = {"api_key": "x", "oauth2_client_info": {"id": "i", "secret": "s"}}

    assert json.get_sensitive_field_paths(
        payload, {"$.*", "$.oauth2_client_info.secret"}
    ) == ["$.api_key", "$.oauth2_client_info.secret"]


@pytest.mark.parametrize("payload", [None, [], ["a", "b"], "text", 42, {}])
def test_get_sensitive_field_paths_malformed_payload(payload: Any) -> None:
    """
    Anything but a non-empty object yields no paths and no error.
    """
    assert json.get_sensitive_field_paths(payload, {"$.*", "$.a.b"}) == []


def test_get_sensitive_field_hints_agree_with_paths() -> None:
    """
    Hints are produced for exactly the paths the path helper lists.
    """
    payload = {"api_key": "k" * 24, "connect_args": {"timeout": 5}, "n": 1}
    fields = {"$.*", "$.connect_args.jwt"}

    hints = json.get_sensitive_field_hints(payload, fields, 4)

    assert [hint["path"] for hint in hints] == json.get_sensitive_field_paths(
        payload, fields
    )


def test_reveal_sensitive_missing_in_old_payload() -> None:
    """
    Test that a masked value with no counterpart in the old payload is passed
    through, matching what engine specs that do not list the path already do.
    """
    old_payload = {"foo": "bar"}
    new_payload = {
        "foo": "bar",
        "oauth2_client_info": {"secret": PASSWORD_MASK},
    }

    assert json.reveal_sensitive(
        old_payload,
        new_payload,
        {"$.oauth2_client_info.secret"},
    ) == {
        "foo": "bar",
        "oauth2_client_info": {"secret": PASSWORD_MASK},
    }


def test_format_timedelta():
    assert json.format_timedelta(timedelta(0)) == "0:00:00"
    assert json.format_timedelta(timedelta(days=1)) == "1 day, 0:00:00"
    assert json.format_timedelta(timedelta(minutes=-6)) == "-0:06:00"
    assert (
        json.format_timedelta(timedelta(0) - timedelta(days=1, hours=5, minutes=6))
        == "-1 day, 5:06:00"
    )
    assert (
        json.format_timedelta(timedelta(0) - timedelta(days=16, hours=4, minutes=3))
        == "-16 days, 4:03:00"
    )


def test_dumps_escapes_non_ascii_by_default() -> None:
    # Default ensure_ascii=True keeps output safe for narrow charset columns
    # (e.g. MySQL utf8) by escaping non-ASCII characters to \uXXXX sequences.
    assert json.dumps("Hello, world!") == '"Hello, world!"'
    assert json.dumps("Привет") == '"\\u041f\\u0440\\u0438\\u0432\\u0435\\u0442"'


def test_dumps_preserves_unicode_when_ensure_ascii_false() -> None:
    # Opt-in ensure_ascii=False renders non-ASCII characters verbatim.
    assert json.dumps("Hello, world!", ensure_ascii=False) == '"Hello, world!"'
    assert json.dumps("Привет, мир!", ensure_ascii=False) == '"Привет, мир!"'
    assert json.dumps("你好，世界！", ensure_ascii=False) == '"你好，世界！"'


@pytest.mark.parametrize("trailer", ["", "\n", "  \r\n"])
def test_get_sensitive_field_hints_unicode_uses_code_points(trailer: str) -> None:
    """
    The suffix is the last code points of the trimmed value, emoji included.
    """
    value = "x" * 15 + "日本語🙂!" + trailer

    assert json.get_sensitive_field_hints({"secret": value}, {"$.secret"}, 5) == [
        {
            "path": "$.secret",
            "suffix": "日本語🙂!",
            "expires_at": None,
            "expired": None,
        }
    ]


def test_get_sensitive_field_hints_mask_literal_is_an_ordinary_string() -> None:
    """
    A stored value equal to the mask literal gets no special treatment.
    """
    value = PASSWORD_MASK * 2

    assert json.get_sensitive_field_hints({"secret": value}, {"$.secret"}, 5) == [
        {
            "path": "$.secret",
            "suffix": "XXXXX",
            "expires_at": None,
            "expired": None,
        }
    ]


def test_get_sensitive_field_hints_large_payload() -> None:
    """
    A 1 MB secret next to thousands of other keys yields one correct hint.
    """
    payload = {
        "connect_args": {"jwt": "j" * (1_000_000 - 4) + "ab3d"},
        "other": {f"key_{i}": f"value_{i}" for i in range(10_000)},
    }

    hints = json.get_sensitive_field_hints(payload, {"$.connect_args.jwt"}, 5)

    assert hints == [
        {
            "path": "$.connect_args.jwt",
            "suffix": "jab3d",
            "expires_at": None,
            "expired": None,
        }
    ]


NOW = datetime(2026, 11, 5, 12, 0, tzinfo=timezone.utc)


def _segment(raw: bytes) -> str:
    """
    Unpadded base64url, as in a JWT.
    """
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _jwt(payload: Any) -> str:
    """
    An HS256-shaped token with a fake signature; bytes are used as the raw payload.
    """
    body = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
    header = _segment(b'{"alg":"HS256","typ":"JWT"}')
    return f"{header}.{_segment(body)}.{_segment(b'not-a-real-signature')}"


@freeze_time(NOW)
def test_jwt_expiry_future_token() -> None:
    """
    A token whose exp is ahead gives that UTC time and is not expired.
    """
    expires = NOW + timedelta(days=60)
    token = _jwt({"sub": "service", "exp": int(expires.timestamp())})

    expires_at, expired = json.jwt_expiry(token)

    assert (expires_at, expired) == (expires, False)
    assert expires_at is not None
    assert expires_at.tzinfo == timezone.utc


@freeze_time(NOW)
def test_jwt_expiry_past_token() -> None:
    """
    A token whose exp has passed is expired.
    """
    expired = NOW - timedelta(days=1)

    assert json.jwt_expiry(_jwt({"exp": int(expired.timestamp())})) == (
        expired,
        True,
    )


@freeze_time(NOW)
def test_jwt_expiry_expires_at_the_exp_second() -> None:
    """
    A token is expired from the second its exp names.
    """
    assert json.jwt_expiry(_jwt({"exp": int(NOW.timestamp())})) == (NOW, True)


def test_jwt_expiry_without_exp() -> None:
    """
    A token without an exp claim has no expiry.
    """
    assert json.jwt_expiry(_jwt({"sub": "service", "iat": 1})) == (None, None)


@pytest.mark.parametrize(
    "value",
    [
        "",
        "hunter2",
        "a" * 40,
        "one.two",
        "one.two.three.four",
        "..",
        _jwt({"exp": 1}) + ".extra",
        _jwt({"exp": 1}).replace(".", " . ", 1),
        "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9!.sig",
        "abcd." + _segment(b'{"exp":1800000000}') + ".sig",
        _segment(b"nope") + "." + _segment(b'{"exp":1800000000}') + ".sig",
        _segment(b'["HS256"]') + "." + _segment(b'{"exp":1800000000}') + ".sig",
        _jwt({"exp": 1_800_000_000}).rsplit(".", 1)[0] + ".abcde",
    ],
)
def test_jwt_expiry_not_a_jwt(value: str) -> None:
    """
    Values that are not three base64url segments, whose header is not a JSON
    object, or whose signature segment does not decode, have no expiry.
    """
    assert json.jwt_expiry(value) == (None, None)


def test_jwt_expiry_pem() -> None:
    """
    A PEM key is not a JWT.
    """
    assert json.jwt_expiry(_pem("Ab3dE")) == (None, None)


def test_jwt_expiry_missing_padding_is_decoded() -> None:
    """
    Payload segments are unpadded base64url; the padding is restored to decode.
    """
    token = _jwt({"exp": 1_800_000_000})

    assert len(token.split(".")[1]) % 4 != 0
    assert json.jwt_expiry(token)[0] == datetime.fromtimestamp(
        1_800_000_000, tz=timezone.utc
    )


# 24 characters, so one more is a length no base64 can have.
_EXP_SEGMENT = _segment(b'{"exp":1800000000}')


@pytest.mark.parametrize(
    "payload_segment",
    [_EXP_SEGMENT + "a", _EXP_SEGMENT + "==", f"{_EXP_SEGMENT[:6]}={_EXP_SEGMENT[6:]}"],
)
def test_jwt_expiry_bad_padding(payload_segment: str) -> None:
    """
    A payload segment with an impossible length or padding characters is not
    decoded.
    """
    header, _, signature = _jwt({"exp": 1}).split(".")

    assert json.jwt_expiry(f"{header}.{payload_segment}.{signature}") == (None, None)


@pytest.mark.parametrize(
    "payload",
    [[1_800_000_000], "exp", 1_800_000_000, None, b"not json", b"\xff\xfe\xfd"],
)
def test_jwt_expiry_non_object_payload(payload: Any) -> None:
    """
    A payload that is not a JSON object has no expiry.
    """
    assert json.jwt_expiry(_jwt(payload)) == (None, None)


@pytest.mark.parametrize(
    "exp, expires_at",
    [
        (1_800_000_000.5, datetime(2027, 1, 15, 8, 0, 0, 500_000, tzinfo=timezone.utc)),
        (1_800_000_000.0, datetime(2027, 1, 15, 8, 0, 0, tzinfo=timezone.utc)),
    ],
)
@freeze_time(NOW)
def test_jwt_expiry_float_exp(exp: float, expires_at: datetime) -> None:
    """
    A non-integer exp, which RFC 7519 allows, is read to the microsecond.
    """
    assert json.jwt_expiry(_jwt({"exp": exp})) == (expires_at, False)


@pytest.mark.parametrize(
    "payload",
    [
        {"exp": "1800000000"},
        {"exp": True},
        {"exp": False},
        {"exp": None},
        {"exp": [1]},
        {"exp": {}},
        b'{"exp": NaN}',
        b'{"exp": Infinity}',
        b'{"exp": -Infinity}',
        b'{"exp": -1e400}',
    ],
)
def test_jwt_expiry_non_numeric_exp(payload: Any) -> None:
    """
    Only a finite number exp, in seconds, is read; a bool is not a number here.
    """
    assert json.jwt_expiry(_jwt(payload)) == (None, None)


@pytest.mark.parametrize(
    "payload",
    [
        {"exp": -1},
        {"exp": 253_402_300_800},
        {"exp": 10**30},
        b'{"exp": 1' + b"0" * 5_000 + b"}",
        b'{"exp": 1e400}',
    ],
)
def test_jwt_expiry_out_of_range_exp(payload: Any) -> None:
    """
    A negative exp or one past the year 9999 has no expiry.
    """
    assert json.jwt_expiry(_jwt(payload)) == (None, None)


@freeze_time(NOW)
def test_jwt_expiry_last_second_of_year_9999() -> None:
    """
    The largest exp a datetime holds is still read.
    """
    assert json.jwt_expiry(_jwt({"exp": 253_402_300_799})) == (
        datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc),
        False,
    )


@pytest.mark.parametrize("value", [None, 1_800_000_000, b"a.b.c"])
def test_jwt_expiry_non_string_value(value: Any) -> None:
    """
    Anything but a string has no expiry, without raising.
    """
    assert json.jwt_expiry(value) == (None, None)


def test_jwt_expiry_large_values_are_rejected_before_decoding() -> None:
    """
    Megabyte values with or without dots fail the shape checks, so nothing is decoded.
    """
    values = ["j" * 1_000_000, "a." * 500_000, "a" * 999_998 + ".."]

    with patch.object(json.jwt, "decode") as decode:
        results = [json.jwt_expiry(value) for value in values]

    assert results == [(None, None)] * 3
    decode.assert_not_called()


@freeze_time(NOW)
def test_get_sensitive_field_hints_jwt_expiry() -> None:
    """
    A JWT hint carries its expiry; any other value carries nulls.
    """
    expires = NOW + timedelta(days=60)
    token = _jwt({"exp": int(expires.timestamp())})
    payload = {"connect_args": {"jwt": token, "password": "hunter2"}}

    hints = json.get_sensitive_field_hints(
        payload, {"$.connect_args.jwt", "$.connect_args.password"}, 5
    )

    assert hints == [
        {
            "path": "$.connect_args.jwt",
            "suffix": token[-5:],
            "expires_at": expires,
            "expired": False,
        },
        {
            "path": "$.connect_args.password",
            "suffix": None,
            "expires_at": None,
            "expired": None,
        },
    ]


@freeze_time(NOW)
def test_get_sensitive_field_hints_expired_jwt_with_whitespace() -> None:
    """
    The expiry is read from the trimmed value.
    """
    token = _jwt({"exp": int((NOW - timedelta(days=2)).timestamp())})

    [hint] = json.get_sensitive_field_hints({"jwt": f"\n {token} \n"}, {"$.jwt"}, 5)

    assert (hint["expires_at"], hint["expired"]) == (NOW - timedelta(days=2), True)


def test_redact_sensitive_leaves_empty_values_unmasked() -> None:
    """An empty secret has nothing to hide, and must not read as a stored one."""
    payload = {"credential": {"username": "", "password": "", "token": None}}

    assert (
        json.redact_sensitive(
            payload,
            {"$.credential.password", "$.credential.token"},
        )
        == payload
    )
    assert json.redact_sensitive(
        {"credential": {"password": "pw"}}, {"$.credential.password"}
    ) == {"credential": {"password": PASSWORD_MASK}}


@pytest.mark.parametrize(
    "old_payload,expected",
    [
        (None, ["$.secret", "$.other"]),
        ({"secret": "stored"}, ["$.other"]),
        ({"secret": "stored", "other": "also"}, []),
        # A stored mask is what master saved when it had nothing to reveal.
        ({"secret": PASSWORD_MASK, "other": "also"}, ["$.secret"]),
        # reveal_sensitive restores any stored value, falsy ones included.
        ({"secret": 0, "other": False}, []),
        # Earlier releases masked an optional secret that was never set, so an
        # archived export asks for a value the connection never had.
        ({"secret": None, "other": ""}, []),
    ],
)
def test_unrevealable_masked_fields(
    old_payload: dict[str, Any] | None, expected: list[str]
) -> None:
    """Masked fields the stored payload has no (non-empty) value for."""
    new_payload = {"secret": PASSWORD_MASK, "other": PASSWORD_MASK, "plain": "x"}

    assert sorted(
        json.unrevealable_masked_fields(
            old_payload, new_payload, {"$.secret", "$.other", "$.plain"}
        )
    ) == sorted(expected)
