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
import os
import traceback
from datetime import datetime
from typing import Any, Type

import click
import pandas as pd
import sqlalchemy as sa

# import json
from flask.cli import with_appcontext
from sqlalchemy.ext.declarative import declarative_base

from superset import db
from superset.migrations.shared.migrate_viz.processors import (
    MigrateAreaChart,
    MigrateBarChart,
    MigrateBubbleChart,
    MigrateDistBarChart,
    MigrateDualLine,
    MigrateHeatmapChart,
    MigrateHistogramChart,
    MigrateLineChart,
    MigratePivotTable,
    MigrateSankey,
    MigrateSunburst,
    MigrateTreeMap,
)
from superset.utils import core as utils, json

Base: Type[Any] = declarative_base()


class Slice(Base):
    __tablename__ = "slices"

    id = sa.Column(sa.Integer, primary_key=True)
    viz_type = sa.Column(sa.String(250))
    params = sa.Column(utils.MediumText())
    query_context = sa.Column(utils.MediumText())


viz_migration_map = {
    MigrateTreeMap.target_viz_type: MigrateTreeMap,
    MigratePivotTable.target_viz_type: MigratePivotTable,
    MigrateDualLine.target_viz_type: MigrateDualLine,
    MigrateLineChart.target_viz_type: MigrateLineChart,
    MigrateAreaChart.target_viz_type: MigrateAreaChart,
    MigrateBarChart.target_viz_type: MigrateBarChart,
    MigrateDistBarChart.target_viz_type: MigrateDistBarChart,
    MigrateBubbleChart.target_viz_type: MigrateBubbleChart,
    MigrateHeatmapChart.target_viz_type: MigrateHeatmapChart,
    MigrateHistogramChart.target_viz_type: MigrateHistogramChart,
    MigrateSankey.target_viz_type: MigrateSankey,
    MigrateSunburst.target_viz_type: MigrateSunburst,
}


def sort_and_clean_object(obj):
    """
    Recursively sort an object (dict or list) and remove any key-value pairs from
    dictionaries where the value is None. If the object is a list of dictionaries,
    sort the list to make order-insensitive comparisons.
    """
    if isinstance(obj, dict):
        cleaned_dict = {k: sort_and_clean_object(v) for k, v in obj.items() if v}
        return cleaned_dict
    elif isinstance(obj, list):
        cleaned_list = [sort_and_clean_object(item) for item in obj if item is not None]
        # If all items in the list are dictionaries, sort them for consistency.
        if all(isinstance(item, dict) for item in cleaned_list):
            return sorted(cleaned_list, key=lambda d: json.dumps(d, sort_keys=True))
        return cleaned_list
    return obj


@click.group()
def generate_query_context() -> None:
    """
    Generate a query context.
    """


@generate_query_context.command()
@with_appcontext
@click.option(
    "--id",
    help="The chart ID.",
    type=int,
    required=False,
)
def run(id: int | None = None) -> None:
    """Generate a query context for a chart"""
    slices = []
    if id:
        slice = db.session.query(Slice).filter(Slice.id == id).one_or_none()
        slices.append(slice)
    else:
        slices = db.session.query(Slice).filter(
            Slice.viz_type.in_(viz_migration_map.keys())
        )

    inconsistent_slices = []
    for slice_item in slices:
        try:
            migration_obj = viz_migration_map.get(slice_item.viz_type)(slice_item.params)
            query_obj = migration_obj.build_query()

            generated_queries_obj = query_obj["queries"]
            stored_queries_obj = json.loads(slice_item.query_context)["queries"]

            sorted_generated = sort_and_clean_object(generated_queries_obj)
            sorted_stored = sort_and_clean_object(stored_queries_obj)

            if sorted_generated != sorted_stored:
                result = json.dumps(sorted_generated, sort_keys=True)
                query_context = json.dumps(sorted_stored, sort_keys=True)
                inconsistent_slices.append(
                    {
                        "slice_id": slice_item.id,
                        "viz_type": slice_item.viz_type,
                        "generated_queries": result,
                        "slice_queries": query_context,
                    }
                )
        except Exception as err:
            error_trace = traceback.format_exc()
            error_result = json.dumps({"error": str(err), "traceback": error_trace}, sort_keys=True)
            inconsistent_slices.append(
                {
                    "slice_id": slice_item.id,
                    "viz_type": slice_item.viz_type,
                    "generated_queries": error_result,
                    "slice_queries": "",
                }
            )

    if inconsistent_slices:
        output_folder = "query_context_results"
        os.makedirs(output_folder, exist_ok=True)
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        csv_filename = os.path.join(output_folder, f"{timestamp}.csv")
        df = pd.DataFrame(inconsistent_slices)
        df.to_csv(csv_filename, index=False)
        click.echo(f"Inconsistent slices saved to: {csv_filename}")
