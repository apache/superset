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

from typing import Any, List, Tuple, Type

from superset.constants import TimeGrain
from superset.db_engine_specs import load_engine_specs
from superset.db_engine_specs.base import BaseEngineSpec


def has_custom_method(spec: Type[BaseEngineSpec], method: str) -> bool:
    """
    Check if a class has a custom implementation of a method.

    Since some classes don't inherit directly from ``BaseEngineSpec`` we need
    to check the attributes of the spec and the base class.
    """
    return bool(
        getattr(spec, method, False)
        and getattr(BaseEngineSpec, method, False)
        and getattr(spec, method).__qualname__
        != getattr(BaseEngineSpec, method).__qualname__
    )


def diagnose(spec: Type[BaseEngineSpec]) -> dict[str, Any]:
    """
    Run basic diagnostics on a given DB engine spec.
    """
    # pylint: disable=import-outside-toplevel
    from superset.sql_validators.postgres import PostgreSQLValidator
    from superset.sql_validators.presto_db import PrestoDBSQLValidator

    sql_validators = {
        "presto": PrestoDBSQLValidator,
        "postgresql": PostgreSQLValidator,
    }

    output: dict[str, Any] = {}

    output["time_grains"] = {}
    supported_time_grains = spec.get_time_grain_expressions()
    for time_grain in TimeGrain:
        output["time_grains"][time_grain.name] = time_grain in supported_time_grains

    output.update(
        {
            "module": spec.__module__,
            "limit_method": spec.limit_method.upper(),
            "joins": spec.allows_joins,
            "subqueries": spec.allows_subqueries,
            "alias_in_select": spec.allows_alias_in_select,
            "alias_in_orderby": spec.allows_alias_in_orderby,
            "secondary_time_columns": spec.time_secondary_columns,
            "time_groupby_inline": spec.time_groupby_inline,
            "alias_to_source_column": not spec.allows_alias_to_source_column,
            "order_by_not_in_select": spec.allows_hidden_orderby_agg,
            "expressions_in_orderby": spec.allows_hidden_cc_in_orderby,
            "cte_in_subquery": spec.allows_cte_in_subquery,
            "limit_clause": spec.allow_limit_clause,
            "max_column_name": spec.max_column_name_length,
            "sql_comments": spec.allows_sql_comments,
            "escaped_colons": spec.allows_escaped_colons,
            "masked_encrypted_extra": has_custom_method(spec, "mask_encrypted_extra"),
            "column_type_mapping": bool(spec.column_type_mappings),
            "function_names": has_custom_method(spec, "get_function_names"),
            # there are multiple ways of implementing user impersonation
            "user_impersonation": (
                has_custom_method(spec, "update_impersonation_config")
                or has_custom_method(spec, "get_url_for_impersonation")
            ),
            "file_upload": spec.supports_file_upload,
            "extra_table_metadata": has_custom_method(spec, "extra_table_metadata"),
            "dbapi_exception_mapping": has_custom_method(
                spec, "get_dbapi_exception_mappin"
            ),
            "custom_errors": (
                has_custom_method(spec, "extract_errors")
                or has_custom_method(spec, "custom_errors")
            ),
            "dynamic_schema": spec.supports_dynamic_schema,
            "catalog": spec.supports_catalog,
            "dynamic_catalog": spec.supports_dynamic_catalog,
            "ssh_tunneling": not spec.disable_ssh_tunneling,
            "query_cancelation": (
                has_custom_method(spec, "cancel_query")
                or has_custom_method(spec, "has_implicit_cancel")
            ),
            "get_metrics": has_custom_method(spec, "get_metrics"),
            "where_latest_partition": has_custom_method(spec, "where_latest_partition"),
            "expand_data": has_custom_method(spec, "expand_data"),
            "query_cost_estimation": has_custom_method(spec, "estimate_query_cost")
            or has_custom_method(spec, "estimate_statement_cost"),
            # SQL validation is implemented in external classes
            "sql_validation": spec.engine in sql_validators,
        },
    )

    # compute score
    score = 0

    # each time grain is 1 point
    score += sum(output["time_grains"][time_grain.name] for time_grain in TimeGrain)

    basic = ["masked_encrypted_extra", "column_type_mapping", "function_names"]
    nice_to_have = [
        "user_impersonation",
        "file_upload",
        "extra_table_metadata",
        "dbapi_exception_mapping",
        "custom_errors",
        "dynamic_schema",
        "catalog",
        "dynamic_catalog",
        "ssh_tunneling",
        "query_cancelation",
        "get_metrics",
        "where_latest_partition",
    ]
    advanced = ["expand_data", "query_cost_estimation", "sql_validation"]
    score += sum(10 * int(output[key]) for key in basic)
    score += sum(10 * int(output[key]) for key in nice_to_have)
    score += sum(10 * int(output[key]) for key in advanced)
    output["score"] = score
    output["max_score"] = (
        len(TimeGrain) + 10 * len(basic) + 10 * len(nice_to_have) + 10 * len(advanced)
    )

    return output


def get_name(spec: Type[BaseEngineSpec]) -> str:
    """
    Return a name for a given DB engine spec.
    """
    return spec.engine_name or spec.engine


def generate_table() -> List[Tuple[Any, ...]]:
    """
    Generate a table showing info for all DB engine specs.

    Data is returned as a list of tuples, appropriate to write to a CSV file.
    """
    info = {}
    for spec in sorted(load_engine_specs(), key=get_name):
        info[get_name(spec)] = diagnose(spec)

    rows = []
    rows.append(tuple(info))  # header row
    rows.append(tuple(db_info["module"] for db_info in info.values()))

    # descriptive
    keys = [
        "limit_method",
        "joins",
        "subqueries",
        "alias_in_select",
        "alias_in_orderby",
        "secondary_time_columns",
        "time_groupby_inline",
        "alias_to_source_column",
        "order_by_not_in_select",
        "expressions_in_orderby",
        "cte_in_subquery",
        "limit_clause",
        "max_column_name",
        "sql_comments",
        "escaped_colons",
    ]
    for key in keys:
        rows.append(tuple(db_info[key] for db_info in info.values()))

    # basic
    for time_grain in TimeGrain:
        rows.append(
            tuple(db_info["time_grains"][time_grain.name] for db_info in info.values())
        )
    keys = [
        "masked_encrypted_extra",
        "column_type_mapping",
        "function_names",
    ]
    for key in keys:
        rows.append(tuple(db_info[key] for db_info in info.values()))

    # nice to have
    keys = [
        "user_impersonation",
        "file_upload",
        "extra_table_metadata",
        "dbapi_exception_mapping",
        "custom_errors",
        "dynamic_schema",
        "catalog",
        "dynamic_catalog",
        "ssh_tunneling",
        "query_cancelation",
        "get_metrics",
        "where_latest_partition",
    ]
    for key in keys:
        rows.append(tuple(db_info[key] for db_info in info.values()))

    # advanced
    keys = [
        "expand_data",
        "query_cost_estimation",
        "sql_validation",
    ]
    for key in keys:
        rows.append(tuple(db_info[key] for db_info in info.values()))

    rows.append(tuple(db_info["score"] for db_info in info.values()))

    return rows


if __name__ == "__main__":
    import csv

    from superset.app import create_app

    app = create_app()
    with app.app_context():
        rows = generate_table()

    with open("db_engine_specs.csv", "w", encoding="utf-8") as fp:
        writer = csv.writer(fp, delimiter="\t")
        for row in rows:
            writer.writerow(row)
