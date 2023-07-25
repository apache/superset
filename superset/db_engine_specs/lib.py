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

from typing import Any, List, Tuple, Type

from superset.constants import TimeGrain
from superset.db_engine_specs import load_engine_specs
from superset.db_engine_specs.base import BaseEngineSpec


def diagnose(spec: Type[BaseEngineSpec]) -> dict[str, Any]:
    """
    Run basic diagnostics on a given DB engine spec.
    """
    from superset.sql_validators.postgres import PostgreSQLValidator
    from superset.sql_validators.presto_db import PrestoDBSQLValidator

    sql_validators = {
        "presto": PrestoDBSQLValidator,
        "postgresql": PostgreSQLValidator,
    }

    output = {}

    output["time_grains"] = {}
    supported_time_grain_expressions = spec.get_time_grain_expressions()
    for time_grain in TimeGrain:
        output["time_grains"][time_grain.name] = (
            time_grain in supported_time_grain_expressions
        )

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
            "masked_encrypted_extra": "mask_encrypted_extra" in spec.__dict__,
            "column_type_mapping": bool(spec.column_type_mappings),
            "function_names": "get_function_names" in spec.__dict__,
            # there are multiple ways of implementing user impersonation
            "user_impersonation": (
                "update_impersonation_config" in spec.__dict__
                or "get_url_for_impersonation" in spec.__dict__
            ),
            "file_upload": spec.supports_file_upload,
            "extra_table_metadata": "extra_table_metadata" in spec.__dict__,
            "dbapi_exception_mapping": "get_dbapi_exception_mappin" in spec.__dict__,
            "custom_errors": (
                "extract_errors" in spec.__dict__ or "custom_errors" in spec.__dict__
            ),
            "dynamic_schema": spec.supports_dynamic_schema,
            "catalog": spec.supports_catalog,
            "dynamic_catalog": spec.supports_dynamic_catalog,
            "ssh_tunneling": not spec.disable_ssh_tunneling,
            "query_cancelation": (
                "cancel_query" in spec.__dict__
                or "has_implicit_cancel" in spec.__dict__
            ),
            "get_metrics": "get_metrics" in spec.__dict__,
            "where_latest_partition": "where_latest_partition" in spec.__dict__,
            "expand_data": "expand_data" in spec.__dict__,
            "query_cost_estimation": "estimate_query_cost" in spec.__dict__
            or "estimate_statement_cost" in spec.__dict__,
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
