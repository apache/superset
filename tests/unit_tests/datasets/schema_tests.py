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

# pylint: disable=import-outside-toplevel, invalid-name, unused-argument, redefined-outer-name
from marshmallow import ValidationError
import pytest

from superset.datasets.schemas import DatasetColumnsPutSchema

# pylint: disable=too-few-public-methods

@pytest.mark.parametrize("payload", [
    (
        {
            "column_name": "insert_time",
            "filterable": True,
            "groupby": True,
            "python_date_format": None,
        }
    ),
    (
        {
            "column_name": "insert_time",
            "filterable": True,
            "groupby": True,
            "python_date_format": "epoch_ms",
        }
    ),
    (
        {
            "column_name": "insert_time",
            "filterable": True,
            "groupby": True,
            "python_date_format": "epoch_s",
        }
    ),
    (
        {
            "column_name": "insert_time",
            "filterable": True,
            "groupby": True,
            "python_date_format": "%Y/%m/%dT%H:%M:%S.%f",
        }
    ),
    (
        {
            "column_name": "insert_time",
            "filterable": True,
            "groupby": True,
            "python_date_format": "%Y%m%d",
        }
    ),
])
def test_datasets_schema_update_column_datetime_format(payload) -> None:
    schema = DatasetColumnsPutSchema()

    try:
        schema.load(payload)
    except ValidationError as err:
        assert False, err.messages