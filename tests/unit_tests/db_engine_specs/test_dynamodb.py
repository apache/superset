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
from datetime import datetime

from tests.unit_tests.fixtures.common import dttm


def test_convert_dttm(dttm: datetime) -> None:
    from superset.db_engine_specs.dynamodb import DynamoDBEngineSpec

    assert DynamoDBEngineSpec.convert_dttm("TEXT", dttm) == "'2019-01-02 03:04:05'"


def test_convert_dttm_lower(dttm: datetime) -> None:
    from superset.db_engine_specs.dynamodb import DynamoDBEngineSpec

    assert DynamoDBEngineSpec.convert_dttm("text", dttm) == "'2019-01-02 03:04:05'"


def test_convert_dttm_invalid_type(dttm: datetime) -> None:
    from superset.db_engine_specs.dynamodb import DynamoDBEngineSpec

    assert DynamoDBEngineSpec.convert_dttm("other", dttm) is None
