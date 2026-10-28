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
from typing import TYPE_CHECKING

import pytest

from superset.exceptions import InvalidPayloadFormatError
from superset.views.base_api import parse_json_form_field

if TYPE_CHECKING:
    from superset.app import SupersetApp


def test_parse_json_form_field_absent(app: "SupersetApp") -> None:
    with app.test_request_context(method="POST", data={"other": "{}"}):
        assert parse_json_form_field("passwords") is None


def test_parse_json_form_field_valid(app: "SupersetApp") -> None:
    with app.test_request_context(
        method="POST", data={"passwords": '{"databases/db.yaml": "secret"}'}
    ):
        assert parse_json_form_field("passwords") == {"databases/db.yaml": "secret"}


def test_parse_json_form_field_malformed(app: "SupersetApp") -> None:
    with app.test_request_context(method="POST", data={"passwords": "{not json"}):
        with pytest.raises(InvalidPayloadFormatError) as excinfo:
            parse_json_form_field("passwords")
    assert excinfo.value.status == 400
    assert excinfo.value.error.message == "Form field 'passwords' is not valid JSON"


@pytest.mark.parametrize("value", ["[]", "[1]", "123", '"secret"', "null"])
def test_parse_json_form_field_not_object(app: "SupersetApp", value: str) -> None:
    with app.test_request_context(method="POST", data={"passwords": value}):
        with pytest.raises(InvalidPayloadFormatError) as excinfo:
            parse_json_form_field("passwords")
    assert excinfo.value.status == 400
    assert excinfo.value.error.message == "Form field 'passwords' must be a JSON object"
