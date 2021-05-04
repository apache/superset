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
# pylint: disable=no-self-use
import pytest

from superset.utils.core import to_adhoc


def test_to_adhoc_generates_deterministic_values():
    input_1 = {
        "op": "IS NOT NULL",
        "col": "LATITUDE",
        "val": "",
    }

    input_2 = {**input_1, "col": "LONGITUDE"}

    # The result is the same when given the same input
    assert to_adhoc(input_1) == to_adhoc(input_1)
    assert to_adhoc(input_1) == {
        "clause": "WHERE",
        "expressionType": "SIMPLE",
        "isExtra": False,
        "comparator": "",
        "operator": "IS NOT NULL",
        "subject": "LATITUDE",
        "filterOptionName": "d0908f77d950131db7a69fdc820cb739",
    }

    # The result is different when given different input
    assert to_adhoc(input_1) != to_adhoc(input_2)
    assert to_adhoc(input_2) == {
        "clause": "WHERE",
        "expressionType": "SIMPLE",
        "isExtra": False,
        "comparator": "",
        "operator": "IS NOT NULL",
        "subject": "LONGITUDE",
        "filterOptionName": "c5f283f727d4dfc6258b351d4a8663bc",
    }
