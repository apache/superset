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
import random
import textwrap
from typing import Dict, Set

import pandas as pd
import pytest
from pandas import DataFrame
from sqlalchemy import column, Float, String

from superset import db
from superset.connectors.sqla.models import SqlaTable, SqlMetric
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils.core import get_example_database
from tests.dashboard_utils import create_slice, create_table_for_dashboard
from tests.test_app import app

misc_dash_slices: Set[str] = set()


@pytest.fixture()
def load_energy_table_with_slice():
    table_name = "energy_usage"
    df = _get_dataframe()
    with app.app_context():
        yield _create_energy_table(df, table_name)
        _cleanup()


def _get_dataframe():
    data = _get_energy_data()
    return pd.DataFrame.from_dict(data)


def _create_energy_table(df: DataFrame, table_name: str):
    database = get_example_database()

    table_description = "Energy consumption"
    schema = {"source": String(255), "target": String(255), "value": Float()}
    table = create_table_for_dashboard(
        df, table_name, database, schema, table_description
    )
    table.fetch_metadata()

    if not any(col.metric_name == "sum__value" for col in table.metrics):
        col = str(column("value").compile(db.engine))
        table.metrics.append(
            SqlMetric(metric_name="sum__value", expression=f"SUM({col})")
        )

    db.session.merge(table)
    db.session.commit()
    table.fetch_metadata()

    for slice_data in _get_energy_slices():
        _create_and_commit_energy_slice(
            table,
            slice_data["slice_title"],
            slice_data["viz_type"],
            slice_data["params"],
        )


def _create_and_commit_energy_slice(
    table: SqlaTable, title: str, viz_type: str, param: Dict[str, str]
):
    slice = create_slice(title, viz_type, table, param)
    existing_slice = (
        db.session.query(Slice).filter_by(slice_name=slice.slice_name).first()
    )
    if existing_slice:
        db.session.delete(existing_slice)
    db.session.add(slice)
    db.session.commit()
    return slice


def _cleanup() -> None:
    engine = get_example_database().get_sqla_engine()
    engine.execute("DROP TABLE IF EXISTS energy_usage")
    for slice_data in _get_energy_slices():
        slice = (
            db.session.query(Slice)
            .filter_by(slice_name=slice_data["slice_title"])
            .first()
        )
        db.session.delete(slice)

    metric = (
        db.session.query(SqlMetric).filter_by(metric_name="sum__value").one_or_none()
    )
    if metric:
        db.session.delete(metric)

    db.session.commit()


def _get_energy_data():
    return [
        {
            "source": "Agricultural Energy Use",
            "target": "Carbon Dioxide",
            "value": "1.4",
        },
        {"source": "Agriculture", "target": "Agriculture Soils", "value": "5.2"},
        {"source": "Agriculture", "target": "Livestock and Manure", "value": "5.4"},
        {"source": "Agriculture", "target": "Other Agriculture", "value": "1.7"},
        {"source": "Agriculture", "target": "Rice Cultivation", "value": "1.5"},
        {"source": "Agriculture Soils", "target": "Nitrous Oxide", "value": "5.2"},
        {"source": "s", "target": "Carbon Dioxide", "value": "1.7"},
        {
            "source": "Aluminium Non-Ferrous Metals",
            "target": "Carbon Dioxide",
            "value": "1.0",
        },
        {
            "source": "Aluminium Non-Ferrous Metals",
            "target": "HFCs - PFCs",
            "value": "0.2",
        },
        {"source": "Cement", "target": "Carbon Dioxide", "value": "5.0"},
        {"source": "Chemicals", "target": "Carbon Dioxide", "value": "3.4"},
        {"source": "Chemicals", "target": "HFCs - PFCs", "value": "0.5"},
        {"source": "Chemicals", "target": "Nitrous Oxide", "value": "0.2"},
        {"source": "Coal Mining", "target": "Carbon Dioxide", "value": "0.1"},
        {"source": "Coal Mining", "target": "Methane", "value": "1.2"},
        {"source": "Commercial Buildings", "target": "Carbon Dioxide", "value": "6.3"},
        {"source": "Deforestation", "target": "Carbon Dioxide", "value": "10.9"},
        {
            "source": "Electricity,heat",
            "target": "Agricultural Energy Use",
            "value": "0.4",
        },
        {
            "source": "Electricity and heat",
            "target": "Aluminium Non-Ferrous Metals",
            "value": "0.4",
        },
        {"source": "Electricity and heat", "target": "Cement", "value": "0.3"},
        {"source": "Electricity and heat", "target": "Chemicals", "value": "1.3"},
        {
            "source": "Electricity and heat",
            "target": "Commercial Buildings",
            "value": "5.0",
        },
        {
            "source": "Electricity and heat",
            "target": "Food and Tobacco",
            "value": "0.5",
        },
        {"source": "Electricity and heat", "target": "Iron and Steel", "value": "1.0"},
        {"source": "Electricity and heat", "target": "Machinery", "value": "1.0"},
        {
            "source": "Electricity and heat",
            "target": "Oil and Gas Processing",
            "value": "0.4",
        },
        {"source": "Electricity and heat", "target": "Other Industry", "value": "2.7"},
        {
            "source": "Electricity and heat",
            "target": "Pulp - Paper and Printing",
            "value": "0.6",
        },
        {
            "source": "Electricity and heat",
            "target": "Residential Buildings",
            "value": "5.2",
        },
        {"source": "Electricity and heat", "target": "T and D Losses", "value": "2.2"},
        {
            "source": "Electricity and heat",
            "target": "Unallocated Fuel Combustion",
            "value": "2.0",
        },
        {"source": "Energy", "target": "Electricity and heat", "value": "24.9"},
        {"source": "Energy", "target": "Fugitive Emissions", "value": "4.0"},
        {"source": "Energy", "target": "Industry", "value": "14.7"},
        {"source": "Energy", "target": "Other Fuel Combustion", "value": "8.6"},
        {"source": "Energy", "target": "Transportation", "value": "14.3"},
        {"source": "Food and Tobacco", "target": "Carbon Dioxide", "value": "1.0"},
        {"source": "Fugitive Emissions", "target": "Coal Mining", "value": "1.3"},
        {
            "source": "Fugitive Emissions",
            "target": "Oil and Gas Processing",
            "value": "3.2",
        },
        {"source": "Harvest \/ Management", "target": "Carbon Dioxide", "value": "1.3"},
        {
            "source": "Industrial Processes",
            "target": "Aluminium Non-Ferrous Metals",
            "value": "0.4",
        },
        {"source": "Industrial Processes", "target": "Cement", "value": "2.8"},
        {"source": "Industrial Processes", "target": "Chemicals", "value": "1.4"},
        {"source": "Industrial Processes", "target": "Other Industry", "value": "0.5"},
        {
            "source": "Industry",
            "target": "Aluminium Non-Ferrous Metals",
            "value": "0.4",
        },
        {"source": "Industry", "target": "Cement", "value": "1.9"},
        {"source": "Industry", "target": "Chemicals", "value": "1.4"},
        {"source": "Industry", "target": "Food and Tobacco", "value": "0.5"},
        {"source": "Industry", "target": "Iron and Steel", "value": "3.0"},
        {"source": "Industry", "target": "Oil and Gas Processing", "value": "2.8"},
        {"source": "Industry", "target": "Other Industry", "value": "3.8"},
        {"source": "Industry", "target": "Pulp - Paper and Printing", "value": "0.5"},
        {"source": "Iron and Steel", "target": "Carbon Dioxide", "value": "4.0"},
        {"source": "Land Use Change", "target": "Deforestation", "value": "10.9"},
        {
            "source": "Land Use Change",
            "target": "Harvest \/ Management",
            "value": "1.3",
        },
        {"source": "Landfills", "target": "Methane", "value": "1.7"},
        {"source": "Livestock and Manure", "target": "Methane", "value": "5.1"},
        {"source": "Livestock and Manure", "target": "Nitrous Oxide", "value": "0.3"},
        {"source": "Machinery", "target": "Carbon Dioxide", "value": "1.0"},
        {
            "source": "Oil and Gas Processing",
            "target": "Carbon Dioxide",
            "value": "3.6",
        },
        {"source": "Oil and Gas Processing", "target": "Methane", "value": "2.8"},
        {"source": "Other Agriculture", "target": "Methane", "value": "1.4"},
        {"source": "Other Agriculture", "target": "Nitrous Oxide", "value": "0.3"},
        {
            "source": "Other Fuel Combustion",
            "target": "Agricultural Energy Use",
            "value": "1.0",
        },
        {
            "source": "Other Fuel Combustion",
            "target": "Commercial Buildings",
            "value": "1.3",
        },
        {
            "source": "Other Fuel Combustion",
            "target": "Residential Buildings",
            "value": "5.0",
        },
        {
            "source": "Other Fuel Combustion",
            "target": "Unallocated Fuel Combustion",
            "value": "1.8",
        },
        {"source": "Other Industry", "target": "Carbon Dioxide", "value": "6.6"},
        {"source": "Other Industry", "target": "HFCs - PFCs", "value": "0.4"},
        {
            "source": "Pulp - Paper and Printing",
            "target": "Carbon Dioxide",
            "value": "1.1",
        },
        {
            "source": "Rail - Ship and Other Transport",
            "target": "Carbon Dioxide",
            "value": "2.5",
        },
        {
            "source": "Residential Buildings",
            "target": "Carbon Dioxide",
            "value": "10.2",
        },
        {"source": "Rice Cultivation", "target": "Methane", "value": "1.5"},
        {"source": "Road", "target": "Carbon Dioxide", "value": "10.5"},
        {"source": "T and D Losses", "target": "Carbon Dioxide", "value": "2.2"},
        {"source": "Transportation", "target": "Air", "value": "1.7"},
        {
            "source": "Transportation",
            "target": "Rail - Ship and Other Transport",
            "value": "2.5",
        },
        {"source": "Transportation", "target": "Road", "value": "10.5"},
        {
            "source": "Unallocated Fuel Combustion",
            "target": "Carbon Dioxide",
            "value": "3.0",
        },
        {"source": "Unallocated Fuel Combustion", "target": "Methane", "value": "0.4"},
        {
            "source": "Unallocated Fuel Combustion",
            "target": "Nitrous Oxide",
            "value": "0.4",
        },
        {"source": "Waste", "target": "Landfills", "value": "1.7"},
        {"source": "Waste", "target": "Waste water - Other Waste", "value": "1.5"},
        {"source": "Waste water - Other Waste", "target": "Methane", "value": "1.2"},
        {
            "source": "Waste water - Other Waste",
            "target": "Nitrous Oxide",
            "value": "0.3",
        },
    ]


def _get_energy_slices():
    return [
        {
            "slice_title": "Energy Sankey",
            "viz_type": "sankey",
            "params": textwrap.dedent(
                """\
            {
                "collapsed_fieldsets": "",
                "groupby": [
                    "source",
                    "target"
                ],
                "metric": "sum__value",
                "row_limit": "5000",
                "slice_name": "Energy Sankey",
                "viz_type": "sankey"
            }
            """
            ),
        },
        {
            "slice_title": "Energy Force Layout",
            "viz_type": "directed_force",
            "params": textwrap.dedent(
                """\
            {
                "charge": "-500",
                "collapsed_fieldsets": "",
                "groupby": [
                    "source",
                    "target"
                ],
                "link_length": "200",
                "metric": "sum__value",
                "row_limit": "5000",
                "slice_name": "Force",
                "viz_type": "directed_force"
            }
            """
            ),
        },
        {
            "slice_title": "Heatmap",
            "viz_type": "heatmap",
            "params": textwrap.dedent(
                """\
            {
                "all_columns_x": "source",
                "all_columns_y": "target",
                "canvas_image_rendering": "pixelated",
                "collapsed_fieldsets": "",
                "linear_color_scheme": "blue_white_yellow",
                "metric": "sum__value",
                "normalize_across": "heatmap",
                "slice_name": "Heatmap",
                "viz_type": "heatmap",
                "xscale_interval": "1",
                "yscale_interval": "1"
            }
            """
            ),
        },
    ]
