"""
Gather performance metrics on Superset chart queries.

Reads the queries from the superset database, and enriches them with the
query_context from the asset files. The query_context cannot be stored in the
database on import due to is using database primary keys which do not match
across Superset installations.
"""

from create_assets import BASE_DIR, ASSET_FOLDER_MAPPING, app

import json
import logging
import os
import time
import uuid
from datetime import datetime
from unittest.mock import patch

import click
import sqlparse
import yaml
from flask import g
from superset import security_manager
from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.charts.schemas import ChartDataQueryContextSchema
from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice

logger = logging.getLogger("performance_metrics")

ASPECTS_VERSION = "{{ASPECTS_VERSION}}"
UUID = str(uuid.uuid4())[0:6]
RUN_ID = f"aspects-{ASPECTS_VERSION}-{UUID}"
CHART_PATH = "/app/openedx-assets/assets/charts/"

report_format = "{i}. {dashboard} - {slice}\n" "Superset time: {superset_time} (s).\n"

query_format = (
    "Query duration: {query_duration_ms} (s).\n"
    "Result rows: {result_rows}\n"
    "Memory Usage (MB): {memory_usage_mb}\n"
    "Row count (superset) {rowcount:}\n"
    "Filters: {filters}\n\n"
)

@click.command()
@click.option(
    "--course_key",
    default="",
    help="A course_key to apply as a filter, you must include the 'course-v1:'.")
@click.option(
    "--dashboard_slug",
    default="",
    help="Only run charts for the given dashboard.")
@click.option(
    "--slice_name",
    default="",
    help="Only run charts for the given slice name, if the name appears in more than "
         "one dashboard it will be run for each.")
@click.option(
    "--print_sql",
    is_flag=True,
    default=False,
    help="Whether to print the SQL run."
)
@click.option(
    "--fail_on_error", is_flag=True, default=False, help="Allow errors to fail the run."
)
def performance_metrics(course_key, dashboard_slug, slice_name, print_sql,
                        fail_on_error):
    """
    Measure the performance of the dashboard.
    """
    # Mock the client name to identify the queries in the clickhouse system.query_log
    # table by by the http_user_agent field.
    extra_filters = []
    if course_key:
        extra_filters += [{"col": "course_key", "op": "==", "val": course_key}]

    with patch("clickhouse_connect.common.build_client_name") as mock_build_client_name:
        mock_build_client_name.return_value = RUN_ID
        target_dashboards = [dashboard_slug] if dashboard_slug else {{SUPERSET_EMBEDDABLE_DASHBOARDS}}

        dashboards = (
            db.session.query(Dashboard)
            .filter(Dashboard.slug.in_(target_dashboards))
            .all()
        )
        report = []

        if not dashboards:
            logger.warning(f"No dashboard found for {target_dashboards}")

        query_contexts = get_query_contexts_from_assets()
        for dashboard in dashboards:
            logger.info(f"Dashboard: {dashboard.slug}")
            for slice in dashboard.slices:
                if slice_name and not slice_name == slice.slice_name:
                    logger.info(f"{slice.slice_name} doesn't match {slice_name}, "
                             f"skipping.")
                    continue

                query_context = get_slice_query_context(
                    slice,
                    query_contexts,
                    extra_filters
                )
                result = measure_chart(slice, query_context, fail_on_error)
                if not result:
                    continue
                for query in result["queries"]:
                    # Remove the data from the query to avoid memory issues on large
                    # datasets.
                    query.pop("data")

                result["dashboard"] = dashboard.slug
                report.append(result)

        if not report:
            logger.warning("No target charts found!")
            return report

        logger.info("Waiting for clickhouse log...")
        time.sleep(20)
        get_query_log_from_clickhouse(report, query_contexts, print_sql, fail_on_error)
        return report


def get_query_contexts_from_assets():
    query_contexts = {}

    for root, dirs, files in os.walk(CHART_PATH):
        for file in files:
            if not file.endswith(".yaml"):
                continue

            path = os.path.join(root, file)
            with open(path, "r") as file:
                asset = yaml.safe_load(file)
                if "query_context" in asset and asset["query_context"]:
                    query_contexts[asset["uuid"]] = asset["query_context"]

    logger.info(f"Found {len(query_contexts)} query contexts")
    return query_contexts


def get_slice_query_context(slice, query_contexts, extra_filters=None):
    if not extra_filters:
        extra_filters = []

    query_context = query_contexts.get(str(slice.uuid), {})
    if not query_context:
        logger.info(f"SLICE {slice} has no query context! {slice.uuid}")
        logger.info(query_contexts.keys())

    query_context.update(
        {
            "result_format": "json",
            "result_type": "full",
            "force": True,
            "datasource": {
                "type": "table",
                "id": slice.datasource_id,
            },
        }
    )

    if extra_filters:
        for query in query_context["queries"]:
            query["filters"] += extra_filters

    return query_context


def measure_chart(slice, query_context, fail_on_error):
    """
    Measure the performance of a chart and return the results.
    """
    logger.info(f"Fetching slice data: {slice}")

    g.user = security_manager.find_user(username="{{SUPERSET_ADMIN_USERNAME}}")
    query_context = ChartDataQueryContextSchema().load(query_context)
    command = ChartDataCommand(query_context)

    start_time = datetime.now()
    try:
        result = command.run()

        for query in result["queries"]:
            if "error" in query and query["error"]:
                raise query["error"]
    except Exception as e:
        logger.error(f"Error fetching slice data: {slice}. Error: {e}")
        if fail_on_error:
            raise e
        return

    end_time = datetime.now()

    result["time_elapsed"] = (end_time - start_time).total_seconds()
    result["slice"] = slice

    return result


def get_query_log_from_clickhouse(report, query_contexts, print_sql, fail_on_error):
    """
    Get the query log from clickhouse and print the results.
    """
    # This corresponds to the "Query Performance" chart in Superset
    chart_uuid = "bb13bb31-c797-4ed3-a7f9-7825cc6dc482"

    slice = db.session.query(Slice).filter(Slice.uuid == chart_uuid).one()

    query_context = get_slice_query_context(slice, query_contexts)
    query_context["queries"][0]["filters"].append(
        {"col": "http_user_agent", "op": "==", "val": RUN_ID}
    )

    ch_chart_result = measure_chart(slice, query_context, fail_on_error)

    clickhouse_queries = {}
    for query in ch_chart_result["queries"]:
        for row in query["data"]:
            parsed_sql = str(sqlparse.parse(row.pop("query"))[0])
            clickhouse_queries[parsed_sql] = row

            if print_sql:
                logger.info("ClickHouse SQL: ")
                logger.info(parsed_sql)

    # Sort report by slowest queries
    report = sorted(report, key=lambda x: x["time_elapsed"], reverse=True)

    report_str = f"\nSuperset Reports: {RUN_ID}\n\n"
    for i, chart_result in enumerate(report):
        report_str += (
            report_format.format(
                i=(i + 1),
                dashboard=chart_result["dashboard"],
                slice=chart_result["slice"],
                superset_time=chart_result["time_elapsed"]
            )
        )
        for i, query in enumerate(chart_result["queries"]):
            parsed_sql = (
                str(sqlparse.parse(query["query"])[0]).replace(";", "")
                + "\n FORMAT Native"
            )

            if print_sql:
                logger.info("Superset SQL: ")
                logger.info(parsed_sql)

            clickhouse_report = clickhouse_queries.get(parsed_sql, {})
            report_str += (
                query_format.format(
                    query_duration_ms=clickhouse_report.get(
                        "query_duration_ms", 0
                    ) / 1000,
                    memory_usage_mb=clickhouse_report.get("memory_usage_mb"),
                    result_rows=clickhouse_report.get("result_rows"),
                    rowcount=query["rowcount"],
                    filters=query["applied_filters"],
                )
            )
    logger.info(report_str)


if __name__ == "__main__":
    logger.info(f"Running performance metrics. RUN ID: {RUN_ID}")
    performance_metrics()
