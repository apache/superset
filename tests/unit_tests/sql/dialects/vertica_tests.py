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

from superset.sql.dialects.vertica import Vertica


def test_last_day_round_trips_natively() -> None:
    """
    Vertica supports LAST_DAY natively, unlike Postgres which rewrites it into
    DATE_TRUNC + INTERVAL arithmetic.
    """
    sql = "SELECT LAST_DAY(DATE('2026-01-15'))"

    ast = parse_one(sql, dialect=Vertica)
    regenerated = ast.sql(dialect=Vertica)

    assert regenerated == "SELECT LAST_DAY(DATE('2026-01-15'))"


def test_last_day_not_rewritten_like_postgres() -> None:
    """
    Postgres rewrites LAST_DAY because it lacks the function. Verify Vertica
    does not inherit that rewrite.
    """
    sql = "SELECT LAST_DAY(DATE('2026-01-15'))"

    postgres_sql = parse_one(sql, dialect="postgres").sql(dialect="postgres")
    vertica_sql = parse_one(sql, dialect=Vertica).sql(dialect=Vertica)

    assert "DATE_TRUNC" in postgres_sql
    assert "DATE_TRUNC" not in vertica_sql
    assert "LAST_DAY" in vertica_sql


def test_translate_from_postgres_to_vertica() -> None:
    """
    A LAST_DAY expression parsed from Postgres should generate the native
    Vertica form, not the Postgres rewrite.
    """
    sql = "SELECT LAST_DAY(DATE('2026-01-15'))"

    ast = parse_one(sql, dialect="postgres")
    regenerated = ast.sql(dialect=Vertica)

    assert regenerated == "SELECT LAST_DAY(DATE('2026-01-15'))"


def test_postgres_features_still_work() -> None:
    """
    Vertica inherits from Postgres, so unrelated Postgres syntax should still
    parse and regenerate correctly.
    """
    sql = "SELECT a::INT, b || c FROM t WHERE d ~ '^foo'"

    ast = parse_one(sql, dialect=Vertica)
    regenerated = ast.sql(dialect=Vertica)

    assert regenerated == "SELECT CAST(a AS INT), b || c FROM t WHERE d ~ '^foo'"


def test_datediff_round_trips_natively() -> None:
    """
    Vertica's DATEDIFF is ``DATEDIFF(unit, start, end)``. Postgres rewrites it
    into ``EXTRACT(epoch ...) / N`` arithmetic.
    """
    sql = "SELECT DATEDIFF('day', a, b) FROM t"

    ast = parse_one(sql, dialect=Vertica)
    regenerated = ast.sql(dialect=Vertica)

    assert regenerated == "SELECT DATEDIFF(DAY, a, b) FROM t"


def test_datediff_month_round_trips_natively() -> None:
    """
    The MONTH unit exercises Postgres's ``AGE()`` rewrite branch, which Vertica
    does not need.
    """
    sql = "SELECT DATEDIFF('month', a, b) FROM t"

    ast = parse_one(sql, dialect=Vertica)
    regenerated = ast.sql(dialect=Vertica)

    assert regenerated == "SELECT DATEDIFF(MONTH, a, b) FROM t"


def test_datediff_not_rewritten_like_postgres() -> None:
    """
    Postgres rewrites DATEDIFF; Vertica should keep the native call.
    """
    sql = "SELECT DATEDIFF('day', a, b) FROM t"

    postgres_sql = parse_one(sql, dialect="postgres").sql(dialect="postgres")
    vertica_sql = parse_one(sql, dialect=Vertica).sql(dialect=Vertica)

    assert "DATEDIFF" not in postgres_sql
    assert "DATEDIFF(DAY" in vertica_sql


def test_median_round_trips_natively() -> None:
    """
    Vertica supports MEDIAN as a native analytic/aggregate function. Postgres
    rewrites it into PERCENTILE_CONT + WITHIN GROUP.
    """
    sql = "SELECT MEDIAN(x) FROM t"

    ast = parse_one(sql, dialect=Vertica)
    regenerated = ast.sql(dialect=Vertica)

    assert regenerated == "SELECT MEDIAN(x) FROM t"


def test_median_not_rewritten_like_postgres() -> None:
    sql = "SELECT MEDIAN(x) FROM t"

    postgres_sql = parse_one(sql, dialect="postgres").sql(dialect="postgres")
    vertica_sql = parse_one(sql, dialect=Vertica).sql(dialect=Vertica)

    assert "PERCENTILE_CONT" in postgres_sql
    assert "PERCENTILE_CONT" not in vertica_sql
    assert "MEDIAN" in vertica_sql


def test_nvl2_round_trips_natively() -> None:
    """
    Vertica supports NVL2 natively; Postgres rewrites it into a CASE.
    """
    sql = "SELECT NVL2(a, b, c) FROM t"

    ast = parse_one(sql, dialect=Vertica)
    regenerated = ast.sql(dialect=Vertica)

    assert regenerated == "SELECT NVL2(a, b, c) FROM t"


def test_nvl2_not_rewritten_like_postgres() -> None:
    sql = "SELECT NVL2(a, b, c) FROM t"

    postgres_sql = parse_one(sql, dialect="postgres").sql(dialect="postgres")
    vertica_sql = parse_one(sql, dialect=Vertica).sql(dialect=Vertica)

    assert "CASE" in postgres_sql
    assert "CASE" not in vertica_sql
    assert "NVL2" in vertica_sql


def test_interval_uses_sql_standard_form() -> None:
    """
    Vertica miscomputes month/year arithmetic when given the Postgres-style
    single-string interval (``INTERVAL '2 MONTH'``). The SQL-standard form
    ``INTERVAL '2' MONTH`` is correct on all Vertica versions.
    See https://forum.vertica.com/discussion/229329/.
    """
    sql = "SELECT date_col + INTERVAL '2 MONTH' FROM t"

    ast = parse_one(sql, dialect=Vertica)
    regenerated = ast.sql(dialect=Vertica)

    assert regenerated == "SELECT date_col + INTERVAL '2' MONTH FROM t"


def test_interval_year_uses_sql_standard_form() -> None:
    sql = "SELECT date_col + INTERVAL '1 YEAR' FROM t"

    ast = parse_one(sql, dialect=Vertica)
    regenerated = ast.sql(dialect=Vertica)

    assert regenerated == "SELECT date_col + INTERVAL '1' YEAR FROM t"


def test_interval_diverges_from_postgres() -> None:
    """
    Postgres emits the combined-string form; Vertica should not.
    """
    sql = "SELECT date_col + INTERVAL '2 MONTH' FROM t"

    postgres_sql = parse_one(sql, dialect="postgres").sql(dialect="postgres")
    vertica_sql = parse_one(sql, dialect=Vertica).sql(dialect=Vertica)

    assert "INTERVAL '2 MONTH'" in postgres_sql
    assert "INTERVAL '2' MONTH" in vertica_sql
