# -*- coding: utf-8 -*-
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
import os
from typing import Any, Dict, Optional

import pytest

from superset.utils.core import (
    is_test,
    parse_boolean_string,
    QueryObjectFilterClause,
    remove_extra_adhoc_filters,
)

ADHOC_FILTER: QueryObjectFilterClause = {
    "col": "foo",
    "op": "==",
    "val": "bar",
}

EXTRA_FILTER: QueryObjectFilterClause = {
    "col": "foo",
    "op": "==",
    "val": "bar",
    "isExtra": True,
}


@pytest.mark.parametrize(
    "original,expected",
    [
        ({"foo": "bar"}, {"foo": "bar"}),
        (
            {"foo": "bar", "adhoc_filters": [ADHOC_FILTER]},
            {"foo": "bar", "adhoc_filters": [ADHOC_FILTER]},
        ),
        (
            {"foo": "bar", "adhoc_filters": [EXTRA_FILTER]},
            {"foo": "bar", "adhoc_filters": []},
        ),
        (
            {
                "foo": "bar",
                "adhoc_filters": [ADHOC_FILTER, EXTRA_FILTER],
            },
            {"foo": "bar", "adhoc_filters": [ADHOC_FILTER]},
        ),
        (
            {
                "foo": "bar",
                "adhoc_filters_b": [ADHOC_FILTER, EXTRA_FILTER],
            },
            {"foo": "bar", "adhoc_filters_b": [ADHOC_FILTER]},
        ),
        (
            {
                "foo": "bar",
                "custom_adhoc_filters": [
                    ADHOC_FILTER,
                    EXTRA_FILTER,
                ],
            },
            {
                "foo": "bar",
                "custom_adhoc_filters": [
                    ADHOC_FILTER,
                    EXTRA_FILTER,
                ],
            },
        ),
    ],
)
def test_remove_extra_adhoc_filters(
    original: Dict[str, Any], expected: Dict[str, Any]
) -> None:
    remove_extra_adhoc_filters(original)
    assert expected == original


def test_is_test():
    orig_value = os.getenv("SUPERSET_TESTENV")

    os.environ["SUPERSET_TESTENV"] = "true"
    assert is_test()
    os.environ["SUPERSET_TESTENV"] = "false"
    assert not is_test()
    os.environ["SUPERSET_TESTENV"] = ""
    assert not is_test()

    if orig_value is not None:
        os.environ["SUPERSET_TESTENV"] = orig_value


@pytest.mark.parametrize(
    "test_input,expected",
    [
        ("y", True),
        ("Y", True),
        ("yes", True),
        ("True", True),
        ("t", True),
        ("true", True),
        ("On", True),
        ("on", True),
        ("1", True),
        ("n", False),
        ("N", False),
        ("no", False),
        ("False", False),
        ("f", False),
        ("false", False),
        ("Off", False),
        ("off", False),
        ("0", False),
        ("foo", False),
        (None, False),
    ],
)
def test_parse_boolean_string(test_input: Optional[str], expected: bool):
    assert parse_boolean_string(test_input) == expected
