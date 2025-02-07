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

from __future__ import annotations

import re
from datetime import datetime
from re import Pattern
from typing import Any, TYPE_CHECKING

from flask_babel import gettext as __
from sqlalchemy import types
from sqlalchemy.engine.reflection import Inspector

from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec
from superset.errors import SupersetErrorType

if TYPE_CHECKING:
    # prevent circular imports
    from superset.models.core import Database


COLUMN_DOES_NOT_EXIST_REGEX = re.compile("no such column: (?P<column_name>.+)")


class SqliteEngineSpec(BaseEngineSpec):
    engine = "sqlite"
    engine_name = "SQLite"

    disable_ssh_tunneling = True

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "DATETIME(STRFTIME('%Y-%m-%dT%H:%M:%S', {col}))",
        TimeGrain.FIVE_SECONDS: (
            "DATETIME({col}, printf('-%d seconds', "
            "CAST(strftime('%S', {col}) AS INT) % 5))"
        ),
        TimeGrain.THIRTY_SECONDS: (
            "DATETIME({col}, printf('-%d seconds', "
            "CAST(strftime('%S', {col}) AS INT) % 30))"
        ),
        TimeGrain.MINUTE: "DATETIME(STRFTIME('%Y-%m-%dT%H:%M:00', {col}))",
        TimeGrain.FIVE_MINUTES: (
            "DATETIME(STRFTIME('%Y-%m-%dT%H:%M:00', {col}), printf('-%d minutes', "
            "CAST(strftime('%M', {col}) AS INT) % 5))"
        ),
        TimeGrain.TEN_MINUTES: (
            "DATETIME(STRFTIME('%Y-%m-%dT%H:%M:00', {col}), printf('-%d minutes', "
            "CAST(strftime('%M', {col}) AS INT) % 10))"
        ),
        TimeGrain.FIFTEEN_MINUTES: (
            "DATETIME(STRFTIME('%Y-%m-%dT%H:%M:00', {col}), printf('-%d minutes', "
            "CAST(strftime('%M', {col}) AS INT) % 15))"
        ),
        TimeGrain.THIRTY_MINUTES: (
            "DATETIME(STRFTIME('%Y-%m-%dT%H:%M:00', {col}), printf('-%d minutes', "
            "CAST(strftime('%M', {col}) AS INT) % 30))"
        ),
        TimeGrain.HOUR: "DATETIME(STRFTIME('%Y-%m-%dT%H:00:00', {col}))",
        TimeGrain.SIX_HOURS: (
            "DATETIME(STRFTIME('%Y-%m-%dT%H:00:00', {col}), printf('-%d hours', "
            "CAST(strftime('%H', {col}) AS INT) % 6))"
        ),
        TimeGrain.DAY: "DATETIME({col}, 'start of day')",
        TimeGrain.WEEK: "DATETIME({col}, 'start of day', \
            -strftime('%w', {col}) || ' days')",
        TimeGrain.MONTH: "DATETIME({col}, 'start of month')",
        TimeGrain.QUARTER: (
            "DATETIME({col}, 'start of month', "
            "printf('-%d month', (strftime('%m', {col}) - 1) % 3))"
        ),
        TimeGrain.YEAR: "DATETIME({col}, 'start of year')",
        TimeGrain.WEEK_ENDING_SATURDAY: "DATETIME({col}, 'start of day', 'weekday 6')",
        TimeGrain.WEEK_ENDING_SUNDAY: "DATETIME({col}, 'start of day', 'weekday 0')",
        TimeGrain.WEEK_STARTING_SUNDAY: "DATETIME({col}, 'start of day', \
            -strftime('%w', {col}) || ' days')",
        TimeGrain.WEEK_STARTING_MONDAY: "DATETIME({col}, 'start of day', '-' || \
            ((strftime('%w', {col}) + 6) % 7) || ' days')",
    }
    # not sure why these are different
    _time_grain_expressions.update(
        {
            TimeGrain.HALF_HOUR: _time_grain_expressions[TimeGrain.THIRTY_MINUTES],
            TimeGrain.QUARTER_YEAR: _time_grain_expressions[TimeGrain.QUARTER],
        }
    )

    custom_errors: dict[Pattern[str], tuple[str, SupersetErrorType, dict[str, Any]]] = {
        COLUMN_DOES_NOT_EXIST_REGEX: (
            __('We can\'t seem to resolve the column "%(column_name)s"'),
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
            {},
        ),
    }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "datetime({col}, 'unixepoch')"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: dict[str, Any] | None = None
    ) -> str | None:
        sqla_type = cls.get_sqla_column_type(target_type)
        if isinstance(sqla_type, (types.String, types.DateTime)):
            return f"""'{dttm.isoformat(sep=" ", timespec="seconds")}'"""
        return None

    @classmethod
    def get_table_names(
        cls,
        database: Database,
        inspector: Inspector,
        schema: str | None,
    ) -> set[str]:
        """Need to disregard the schema for Sqlite"""
        return set(inspector.get_table_names())

    @classmethod
    def get_function_names(
        cls,
        database: Database,
    ) -> list[str]:
        """
        Return function names.
        """
        return [
            "abs",
            "acos",
            "acosh",
            "asin",
            "asinh",
            "atan",
            "atan2",
            "atanh",
            "avg",
            "ceil",
            "ceiling",
            "changes",
            "char",
            "coalesce",
            "cos",
            "cosh",
            "count",
            "cume_dist",
            "date",
            "datetime",
            "degrees",
            "dense_rank",
            "exp",
            "first_value",
            "floor",
            "format",
            "glob",
            "group_concat",
            "hex",
            "ifnull",
            "iif",
            "instr",
            "json",
            "json_array",
            "json_array_length",
            "json_each",
            "json_error_position",
            "json_extract",
            "json_group_array",
            "json_group_object",
            "json_insert",
            "json_object",
            "json_patch",
            "json_quote",
            "json_remove",
            "json_replace",
            "json_set",
            "json_tree",
            "json_type",
            "json_valid",
            "julianday",
            "lag",
            "last_insert_rowid",
            "last_value",
            "lead",
            "length",
            "like",
            "likelihood",
            "likely",
            "ln",
            "load_extension",
            "log",
            "log10",
            "log2",
            "lower",
            "ltrim",
            "max",
            "min",
            "mod",
            "nth_value",
            "ntile",
            "nullif",
            "percent_rank",
            "pi",
            "pow",
            "power",
            "printf",
            "quote",
            "radians",
            "random",
            "randomblob",
            "rank",
            "replace",
            "round",
            "row_number",
            "rtrim",
            "sign",
            "sin",
            "sinh",
            "soundex",
            "sqlite_compileoption_get",
            "sqlite_compileoption_used",
            "sqlite_offset",
            "sqlite_source_id",
            "sqlite_version",
            "sqrt",
            "strftime",
            "substr",
            "substring",
            "sum",
            "tan",
            "tanh",
            "time",
            "total_changes",
            "trim",
            "trunc",
            "typeof",
            "unhex",
            "unicode",
            "unixepoch",
            "unlikely",
            "upper",
            "zeroblob",
        ]
