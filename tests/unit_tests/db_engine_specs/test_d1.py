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
# pylint: disable=invalid-name, unused-argument, import-outside-toplevel, redefined-outer-name
from __future__ import annotations

import pytest
from sqlalchemy import types

from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import assert_column_spec


@pytest.mark.parametrize(
    "native_type,sqla_type,generic_type,is_dttm",
    [
        ("DATETIME", types.DateTime, GenericDataType.TEMPORAL, True),
        ("TIMESTAMP", types.TIMESTAMP, GenericDataType.TEMPORAL, True),
        ("DATE", types.Date, GenericDataType.TEMPORAL, True),
        ("TIME", types.Time, GenericDataType.TEMPORAL, True),
        ("BOOLEAN", types.Boolean, GenericDataType.BOOLEAN, False),
        ("INTEGER", types.Integer, GenericDataType.NUMERIC, False),
        ("TEXT", types.String, GenericDataType.STRING, False),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[types.TypeEngine],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    """
    Test the type names the ``d1`` dialect of sqlalchemy-d1 0.2.0 reports.

    The dialect prints ``DATETIME``, ``TIMESTAMP``, ``DATE``, ``TIME`` and
    ``BOOLEAN`` for columns declared with those types, so they must map to
    temporal and boolean columns rather than to strings and numbers.
    """
    from superset.db_engine_specs.d1 import CloudflareD1EngineSpec as spec  # noqa: N813

    assert_column_spec(spec, native_type, sqla_type, None, generic_type, is_dttm)


@pytest.mark.parametrize(
    "sql",
    [
        "-- top customers\nSELECT * FROM orders",
        "/* top customers */ SELECT * FROM orders",
    ],
)
def test_leading_comment_is_stripped(sql: str) -> None:
    """
    Test that a comment ahead of a query is dropped before execution.

    The DBAPI only reports column names when the statement text starts with
    ``SELECT``, ``PRAGMA`` or ``WITH``, so a leading comment would return rows
    without a cursor description.
    """
    from superset.db_engine_specs.d1 import CloudflareD1EngineSpec as spec  # noqa: N813
    from superset.sql.parse import SQLScript

    [statement] = SQLScript(sql, engine=spec.engine).statements
    formatted = statement.format(comments=spec.allows_sql_comments)

    assert formatted.startswith("SELECT")
    assert "top customers" not in formatted


def test_metadata_points_at_sqlalchemy_d1() -> None:
    """
    Test that the docs metadata names ``sqlalchemy-d1`` as the only package and
    installs it through the ``d1`` extra.
    """
    from superset.db_engine_specs.d1 import CloudflareD1EngineSpec

    metadata = CloudflareD1EngineSpec.metadata

    assert metadata["pypi_packages"] == ["sqlalchemy-d1"]
    assert metadata["install_instructions"] == 'pip install "apache-superset[d1]"'
