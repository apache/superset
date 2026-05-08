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

"""
Vertica dialect.

Vertica is wire-compatible with PostgreSQL but provides additional analytical
functions natively. This dialect extends the Postgres dialect to preserve
Vertica-native functions that the Postgres generator would otherwise rewrite.
"""

from __future__ import annotations

from sqlglot import exp
from sqlglot.dialects.dialect import date_delta_sql
from sqlglot.dialects.postgres import Postgres
from sqlglot.helper import seq_get


def _build_datediff(args: list[exp.Expression]) -> exp.DateDiff:
    # Vertica's signature is DATEDIFF(unit, start, end); the default sqlglot
    # parser assumes (end, start, unit), so we remap the positional args.
    return exp.DateDiff(
        this=seq_get(args, 2),
        expression=seq_get(args, 1),
        unit=exp.var(seq_get(args, 0).name) if seq_get(args, 0) else None,
    )


class Vertica(Postgres):
    """
    Vertica dialect.

    Extends PostgreSQL by keeping functions that Vertica supports natively but
    Postgres does not (e.g. ``LAST_DAY``, ``DATEDIFF``, ``MEDIAN``, ``NVL2``).
    """

    class Parser(Postgres.Parser):
        FUNCTIONS = {
            **Postgres.Parser.FUNCTIONS,
            "DATEDIFF": _build_datediff,
            "TIMESTAMPDIFF": _build_datediff,
        }

    class Generator(Postgres.Generator):
        # Vertica's LAST_DAY only accepts a date/timestamp; it does not take a
        # date part argument like Snowflake's variant.
        LAST_DAY_SUPPORTS_DATE_PART = False

        # Vertica supports MEDIAN and NVL2 natively; Postgres does not, and the
        # inherited generator rewrites them into PERCENTILE_CONT and CASE
        # expressions respectively.
        SUPPORTS_MEDIAN = True
        NVL2_SUPPORTED = True

        # Emit INTERVAL '<value>' <unit> (SQL-standard) instead of the
        # Postgres-style INTERVAL '<value> <unit>'. Vertica miscomputes the
        # combined-string form for MONTH/YEAR units (treats them as a fixed
        # number of days). See https://forum.vertica.com/discussion/229329/.
        SINGLE_STRING_INTERVAL = False

        TRANSFORMS = {
            **Postgres.Generator.TRANSFORMS,
            # Postgres rewrites LAST_DAY into DATE_TRUNC + INTERVAL arithmetic
            # because it lacks the function. Vertica supports it natively, so
            # drop the rewrite and fall back to the base lastday_sql.
            exp.LastDay: lambda self, e: self.function_fallback_sql(e),
            # Postgres rewrites DATEDIFF into EXTRACT(epoch ...) / AGE() math.
            # Vertica's native form is DATEDIFF(unit, start, end), matching
            # Snowflake's signature.
            exp.DateDiff: date_delta_sql("DATEDIFF"),
            exp.TsOrDsDiff: date_delta_sql("DATEDIFF"),
        }
