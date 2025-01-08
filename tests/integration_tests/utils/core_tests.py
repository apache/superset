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
import pytest

from superset.utils.core import form_data_to_adhoc, simple_filter_to_adhoc


def test_simple_filter_to_adhoc_generates_deterministic_values():
    input_1 = {
        "op": "IS NOT NULL",
        "col": "LATITUDE",
        "val": "",
    }

    input_2 = {**input_1, "col": "LONGITUDE"}

    # The result is the same when given the same input
    assert simple_filter_to_adhoc(input_1) == simple_filter_to_adhoc(input_1)
    assert simple_filter_to_adhoc(input_1) == {
        "clause": "WHERE",
        "expressionType": "SIMPLE",
        "comparator": "",
        "operator": "IS NOT NULL",
        "subject": "LATITUDE",
        "filterOptionName": "6ac89d498115da22396f80a765cffc70",
    }

    # The result is different when given different input
    assert simple_filter_to_adhoc(input_1) != simple_filter_to_adhoc(input_2)
    assert simple_filter_to_adhoc(input_2) == {
        "clause": "WHERE",
        "expressionType": "SIMPLE",
        "comparator": "",
        "operator": "IS NOT NULL",
        "subject": "LONGITUDE",
        "filterOptionName": "9c984bd3714883ca859948354ce26ab9",
    }


def test_form_data_to_adhoc_generates_deterministic_values():
    form_data = {"where": "1 = 1", "having": "count(*) > 1"}

    # The result is the same when given the same input
    assert form_data_to_adhoc(form_data, "where") == form_data_to_adhoc(
        form_data, "where"
    )
    assert form_data_to_adhoc(form_data, "where") == {
        "clause": "WHERE",
        "expressionType": "SQL",
        "sqlExpression": "1 = 1",
        "filterOptionName": "99fe79985afbddea4492626dc6a87b74",
    }

    # The result is different when given different input
    assert form_data_to_adhoc(form_data, "having") == form_data_to_adhoc(
        form_data, "having"
    )
    assert form_data_to_adhoc(form_data, "having") == {
        "clause": "HAVING",
        "expressionType": "SQL",
        "sqlExpression": "count(*) > 1",
        "filterOptionName": "1da11f6b709c3190daeabb84f77fc8c2",
    }


def test_form_data_to_adhoc_incorrect_clause_type():
    form_data = {"where": "1 = 1", "having": "count(*) > 1"}

    with pytest.raises(ValueError):  # noqa: PT011
        form_data_to_adhoc(form_data, "foobar")
