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

from sqlglot import parse_one

from superset.sql.dialects.dremio import Dremio


def test_regexp_split() -> None:
    """
    Test that regexp_split works correctly in Dremio dialect.
    """
    sql = "SELECT REGEXP_SPLIT(tags, ',', 'ALL', 1000) as t"

    ast = parse_one(sql, dialect=Dremio)
    regenerated = ast.sql(dialect=Dremio)

    assert regenerated == "SELECT REGEXP_SPLIT(tags, ',', 'ALL', 1000) AS t"


def test_inherits_sqlglot_native_type_mapping() -> None:
    """
    Superset's Dremio dialect is built on sqlglot's native Dremio dialect,
    not a bare Dialect base, so it should get correct type mapping for free
    (e.g. TINYINT, which Dremio doesn't support, maps to INT).
    """
    sql = "SELECT CAST(x AS TINYINT)"

    ast = parse_one(sql, dialect=Dremio)
    regenerated = ast.sql(dialect=Dremio)

    assert regenerated == "SELECT CAST(x AS INT)"


def test_inherits_sqlglot_native_current_date_utc() -> None:
    """
    sqlglot's native Dremio dialect round-trips CURRENT_DATE_UTC(); a bare
    Dialect base does not understand this Dremio-specific construct.
    """
    sql = "SELECT CURRENT_DATE_UTC()"

    ast = parse_one(sql, dialect=Dremio)
    regenerated = ast.sql(dialect=Dremio)

    assert regenerated == "SELECT CURRENT_DATE_UTC"
