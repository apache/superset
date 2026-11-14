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
import pytest

from superset import db
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils.database import get_example_database
from tests.integration_tests.dashboard_utils import create_table_metadata


@pytest.fixture
def lineage_test_data(app_context, load_birth_names_data):
    """
    Base fixture that creates a simple lineage structure and returns
    the created entities (database, dataset, charts, dashboard).
    """
    database = get_example_database()

    # Create dataset
    dataset = create_table_metadata(
        table_name="lineage_test_dataset",
        database=database,
    )
    db.session.add(dataset)
    db.session.flush()

    # Create charts
    chart1 = Slice(
        slice_name="Lineage Test Chart 1",
        viz_type="table",
        datasource_id=dataset.id,
        datasource_type="table",
        params="{}",
    )
    chart2 = Slice(
        slice_name="Lineage Test Chart 2",
        viz_type="pie",
        datasource_id=dataset.id,
        datasource_type="table",
        params="{}",
    )
    db.session.add(chart1)
    db.session.add(chart2)
    db.session.flush()

    # Create dashboard with charts
    dashboard = Dashboard(
        dashboard_title="Lineage Test Dashboard",
        slug="lineage-test-dashboard",
        slices=[chart1, chart2],
        published=True,
    )
    db.session.add(dashboard)
    db.session.commit()

    # Return the created entities
    result = {
        "database": database,
        "dataset": dataset,
        "charts": [chart1, chart2],
        "dashboard": dashboard,
    }

    yield result

    # Cleanup
    db.session.delete(dashboard)
    db.session.delete(chart1)
    db.session.delete(chart2)
    for col in dataset.columns + dataset.metrics:
        db.session.delete(col)
    db.session.delete(dataset)
    db.session.commit()


@pytest.fixture(autouse=False)
def inject_expected_dataset_lineage(request, lineage_test_data):
    """
    Injects dataset lineage data into test class instance.
    """
    dataset = lineage_test_data["dataset"]
    database = lineage_test_data["database"]
    charts = lineage_test_data["charts"]
    dashboard = lineage_test_data["dashboard"]

    request.instance.dataset_lineage = {
        "dataset_id": dataset.id,
        "expected": {
            "dataset": {
                "id": dataset.id,
                "name": dataset.name,
                "schema": dataset.schema,
                "table_name": dataset.table_name,
                "database_id": database.id,
                "database_name": database.database_name,
            },
            "upstream": {
                "database": {
                    "id": database.id,
                    "database_name": database.database_name,
                    "backend": database.backend,
                }
            },
            "downstream": {
                "charts": {
                    "count": 2,
                    "result": [
                        {
                            "id": charts[0].id,
                            "slice_name": charts[0].slice_name,
                            "viz_type": charts[0].viz_type,
                            "dashboard_ids": [dashboard.id],
                        },
                        {
                            "id": charts[1].id,
                            "slice_name": charts[1].slice_name,
                            "viz_type": charts[1].viz_type,
                            "dashboard_ids": [dashboard.id],
                        },
                    ],
                },
                "dashboards": {
                    "count": 1,
                    "result": [
                        {
                            "id": dashboard.id,
                            "title": dashboard.dashboard_title,
                            "slug": dashboard.slug,
                            "chart_ids": sorted([charts[0].id, charts[1].id]),
                        }
                    ],
                },
            },
        },
    }


@pytest.fixture(autouse=False)
def inject_expected_chart_lineage(request, lineage_test_data):
    """
    Injects chart lineage data into test class instance.
    """
    dataset = lineage_test_data["dataset"]
    database = lineage_test_data["database"]
    chart = lineage_test_data["charts"][0]  # Use first chart
    dashboard = lineage_test_data["dashboard"]

    request.instance.chart_lineage = {
        "chart_id": chart.id,
        "expected": {
            "chart": {
                "id": chart.id,
                "slice_name": chart.slice_name,
                "viz_type": chart.viz_type,
            },
            "upstream": {
                "dataset": {
                    "id": dataset.id,
                    "name": dataset.name,
                    "schema": dataset.schema,
                    "table_name": dataset.table_name,
                    "database_id": database.id,
                    "database_name": database.database_name,
                },
                "database": {
                    "id": database.id,
                    "database_name": database.database_name,
                    "backend": database.backend,
                },
            },
            "downstream": {
                "dashboards": {
                    "count": 1,
                    "result": [
                        {
                            "id": dashboard.id,
                            "title": dashboard.dashboard_title,
                            "slug": dashboard.slug,
                        }
                    ],
                }
            },
        },
    }


@pytest.fixture(autouse=False)
def inject_expected_dashboard_lineage(request, lineage_test_data):
    """
    Injects dashboard lineage data into test class instance.
    """
    dataset = lineage_test_data["dataset"]
    database = lineage_test_data["database"]
    charts = lineage_test_data["charts"]
    dashboard = lineage_test_data["dashboard"]

    request.instance.dashboard_lineage = {
        "dashboard_id": dashboard.id,
        "expected": {
            "dashboard": {
                "id": dashboard.id,
                "title": dashboard.dashboard_title,
                "slug": dashboard.slug,
                "published": dashboard.published,
            },
            "upstream": {
                "charts": {
                    "count": 2,
                    "result": [
                        {
                            "id": charts[0].id,
                            "slice_name": charts[0].slice_name,
                            "viz_type": charts[0].viz_type,
                            "dataset_id": dataset.id,
                        },
                        {
                            "id": charts[1].id,
                            "slice_name": charts[1].slice_name,
                            "viz_type": charts[1].viz_type,
                            "dataset_id": dataset.id,
                        },
                    ],
                },
                "datasets": {
                    "count": 1,
                    "result": [
                        {
                            "id": dataset.id,
                            "name": dataset.name,
                            "schema": dataset.schema,
                            "table_name": dataset.table_name,
                            "database_id": database.id,
                            "database_name": database.database_name,
                            "chart_ids": sorted([charts[0].id, charts[1].id]),
                        }
                    ],
                },
                "databases": {
                    "count": 1,
                    "result": [
                        {
                            "id": database.id,
                            "database_name": database.database_name,
                            "backend": database.backend,
                        }
                    ],
                },
            },
            "downstream": None,
        },
    }
