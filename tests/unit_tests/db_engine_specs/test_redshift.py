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
from typing import Optional

import pytest

from superset.db_engine_specs.redshift import RedshiftEngineSpec
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "TO_DATE('2019-01-02', 'YYYY-MM-DD')"),
        (
            "DateTime",
            "TO_TIMESTAMP('2019-01-02 03:04:05.678900', 'YYYY-MM-DD HH24:MI:SS.US')",
        ),
        (
            "TimeStamp",
            "TO_TIMESTAMP('2019-01-02 03:04:05.678900', 'YYYY-MM-DD HH24:MI:SS.US')",
        ),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.redshift import (
        RedshiftEngineSpec as spec,  # noqa: N813
    )

    assert_convert_dttm(spec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    "table_name,schema_name,expected_table,expected_schema",
    [
        ("BPO_mytest_2", "MySchema", "bpo_mytest_2", "myschema"),
        ("MY_TABLE", None, "my_table", None),
        ("already_lower", "lower_schema", "already_lower", "lower_schema"),
    ],
)
def test_normalize_table_name_for_upload(
    table_name: str,
    schema_name: Optional[str],
    expected_table: str,
    expected_schema: Optional[str],
) -> None:
    """
    Test that table and schema names are normalized to lowercase for Redshift.

    Redshift folds unquoted identifiers to lowercase, so we need to normalize
    table names to ensure consistent behavior when checking table existence
    and performing replace operations.
    """
    normalized_table, normalized_schema = (
        RedshiftEngineSpec.normalize_table_name_for_upload(table_name, schema_name)
    )

    assert normalized_table == expected_table
    assert normalized_schema == expected_schema
