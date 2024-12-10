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
# isort:skip_file
"""Unit tests for Superset"""

import unittest
import copy
from datetime import datetime
from io import BytesIO
import time
from typing import Any, Optional
from unittest import mock
from zipfile import ZipFile

from flask import Response
from flask.ctx import AppContext
from tests.integration_tests.conftest import with_feature_flags
from superset.charts.data.api import ChartDataRestApi
from superset.models.sql_lab import Query
from tests.integration_tests.base_tests import SupersetTestCase, test_client
from tests.integration_tests.annotation_layers.fixtures import create_annotation_layers  # noqa: F401
from tests.integration_tests.constants import (
    ADMIN_USERNAME,
    GAMMA_NO_CSV_USERNAME,
    GAMMA_USERNAME,
)
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)
from tests.integration_tests.test_app import app
from tests.integration_tests.fixtures.energy_dashboard import (
    load_energy_table_with_slice,  # noqa: F401
    load_energy_table_data,  # noqa: F401
)
import pytest
from superset.models.slice import Slice

from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.connectors.sqla.models import TableColumn, SqlaTable
from superset.errors import SupersetErrorType
from superset.extensions import async_query_manager_factory, db
from superset.models.annotations import AnnotationLayer
from superset.superset_typing import AdhocColumn
from superset.utils.core import (
    AnnotationType,
    backend,
    get_example_default_schema,
    AdhocMetricExpressionType,
    ExtraFiltersReasonType,
)
from superset.utils import json
from superset.utils.database import get_example_database, get_main_database
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType

from tests.common.query_context_generator import ANNOTATION_LAYERS
from tests.integration_tests.fixtures.query_context import get_query_context

from tests.integration_tests.test_app import app  # noqa: F811


CHART_DATA_URI = "api/v1/chart/data"
CHARTS_FIXTURE_COUNT = 10
ADHOC_COLUMN_FIXTURE: AdhocColumn = {
    "hasCustomLabel": True,
    "label": "male_or_female",
    "sqlExpression": "case when gender = 'boy' then 'male' "
    "when gender = 'girl' then 'female' else 'other' end",
}

INCOMPATIBLE_ADHOC_COLUMN_FIXTURE: AdhocColumn = {
    "hasCustomLabel": True,
    "label": "exciting_or_boring",
    "sqlExpression": "case when genre = 'Action' then 'Exciting' else 'Boring' end",
}


@pytest.fixture(autouse=True)
def skip_by_backend(app_context: AppContext):
    if backend() == "hive":
        pytest.skip("Skipping tests for Hive backend")


class BaseTestChartDataApi(SupersetTestCase):
    query_context_payload_template = None

    def setUp(self) -> None:
        self.login(ADMIN_USERNAME)
        if self.query_context_payload_template is None:
            BaseTestChartDataApi.query_context_payload_template = get_query_context(
                "birth_names"
            )
        self.query_context_payload = (
            copy.deepcopy(self.query_context_payload_template) or {}
        )

    def get_expected_row_count(self, client_id: str) -> int:
        start_date = datetime.now()
        start_date = start_date.replace(
            year=start_date.year - 100, hour=0, minute=0, second=0
        )

        quoted_table_name = self.quote_name("birth_names")
        sql = f"""
                            SELECT COUNT(*) AS rows_count FROM (
                                SELECT name AS name, SUM(num) AS sum__num
                                FROM {quoted_table_name}
                                WHERE ds >= '{start_date.strftime("%Y-%m-%d %H:%M:%S")}'
                                AND gender = 'boy'
                                GROUP BY name
                                ORDER BY sum__num DESC
                                LIMIT 100) AS inner__query
                        """
        resp = self.run_sql(sql, client_id, raise_on_error=True)
        db.session.query(Query).delete()
        db.session.commit()
        return resp["data"][0]["rows_count"]

    def quote_name(self, name: str):
        if get_main_database().backend in {"presto", "hive"}:
            with get_example_database().get_inspector() as inspector:  # E: Ne
                return inspector.engine.dialect.identifier_preparer.quote_identifier(
                    name
                )
        return name


@pytest.mark.chart_data_flow
class TestPostChartDataApi(BaseTestChartDataApi):
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test__map_form_data_datasource_to_dataset_id(self):
        # arrange
        self.query_context_payload["datasource"] = {"id": 1, "type": "table"}
        # act
        response = ChartDataRestApi._map_form_data_datasource_to_dataset_id(
            ChartDataRestApi, self.query_context_payload
        )
        # assert
        assert response == {"dashboard_id": None, "dataset_id": 1, "slice_id": None}

        # takes malformed content without raising an error
        self.query_context_payload["datasource"] = "1__table"
        # act
        response = ChartDataRestApi._map_form_data_datasource_to_dataset_id(
            ChartDataRestApi, self.query_context_payload
        )
        # assert
        assert response == {"dashboard_id": None, "dataset_id": None, "slice_id": None}

        # takes a slice id
        self.query_context_payload["datasource"] = None
        self.query_context_payload["form_data"] = {"slice_id": 1}
        # act
        response = ChartDataRestApi._map_form_data_datasource_to_dataset_id(
            ChartDataRestApi, self.query_context_payload
        )
        # assert
        assert response == {"dashboard_id": None, "dataset_id": None, "slice_id": 1}

        # takes missing slice id
        self.query_context_payload["datasource"] = None
        self.query_context_payload["form_data"] = {"foo": 1}
        # act
        response = ChartDataRestApi._map_form_data_datasource_to_dataset_id(
            ChartDataRestApi, self.query_context_payload
        )
        # assert
        assert response == {"dashboard_id": None, "dataset_id": None, "slice_id": None}

        # takes a dashboard id
        self.query_context_payload["form_data"] = {"dashboardId": 1}
        # act
        response = ChartDataRestApi._map_form_data_datasource_to_dataset_id(
            ChartDataRestApi, self.query_context_payload
        )
        # assert
        assert response == {"dashboard_id": 1, "dataset_id": None, "slice_id": None}

        # takes a dashboard id and a slice id
        self.query_context_payload["form_data"] = {"dashboardId": 1, "slice_id": 2}
        # act
        response = ChartDataRestApi._map_form_data_datasource_to_dataset_id(
            ChartDataRestApi, self.query_context_payload
        )
        # assert
        assert response == {"dashboard_id": 1, "dataset_id": None, "slice_id": 2}

        # takes a dashboard id, slice id and a dataset id
        self.query_context_payload["datasource"] = {"id": 3, "type": "table"}
        self.query_context_payload["form_data"] = {"dashboardId": 1, "slice_id": 2}
        # act
        response = ChartDataRestApi._map_form_data_datasource_to_dataset_id(
            ChartDataRestApi, self.query_context_payload
        )
        # assert
        assert response == {"dashboard_id": 1, "dataset_id": 3, "slice_id": 2}

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @mock.patch("superset.utils.decorators.g")
    def test_with_valid_qc__data_is_returned(self, mock_g):
        mock_g.logs_context = {}
        # arrange
        expected_row_count = self.get_expected_row_count("client_id_1")
        # act
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        # assert
        assert rv.status_code == 200
        self.assert_row_count(rv, expected_row_count)

        # check that global logs decorator is capturing from form_data
        assert isinstance(mock_g.logs_context.get("dataset_id"), int)

    @staticmethod
    def assert_row_count(rv: Response, expected_row_count: int):
        assert rv.json["result"][0]["rowcount"] == expected_row_count

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @mock.patch(
        "superset.common.query_context_factory.config",
        {**app.config, "ROW_LIMIT": 7},
    )
    def test_without_row_limit__row_count_as_default_row_limit(self):
        # arrange
        expected_row_count = 7
        del self.query_context_payload["queries"][0]["row_limit"]
        # act
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        # assert
        self.assert_row_count(rv, expected_row_count)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @mock.patch(
        "superset.common.query_context_factory.config",
        {**app.config, "SAMPLES_ROW_LIMIT": 5},
    )
    def test_as_samples_without_row_limit__row_count_as_default_samples_row_limit(self):
        # arrange
        expected_row_count = 5
        app.config["SAMPLES_ROW_LIMIT"] = expected_row_count
        self.query_context_payload["result_type"] = ChartDataResultType.SAMPLES
        del self.query_context_payload["queries"][0]["row_limit"]

        # act
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")

        # assert
        self.assert_row_count(rv, expected_row_count)
        assert "GROUP BY" not in rv.json["result"][0]["query"]

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @mock.patch(
        "superset.utils.core.current_app.config",
        {**app.config, "SQL_MAX_ROW": 10},
    )
    def test_with_row_limit_bigger_then_sql_max_row__rowcount_as_sql_max_row(self):
        # arrange
        expected_row_count = 10
        self.query_context_payload["queries"][0]["row_limit"] = 10000000

        # act
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")

        # assert
        self.assert_row_count(rv, expected_row_count)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @mock.patch(
        "superset.utils.core.current_app.config",
        {**app.config, "SQL_MAX_ROW": 5},
    )
    def test_as_samples_with_row_limit_bigger_then_sql_max_row_rowcount_as_sql_max_row(
        self,
    ):
        expected_row_count = app.config["SQL_MAX_ROW"]
        self.query_context_payload["result_type"] = ChartDataResultType.SAMPLES
        self.query_context_payload["queries"][0]["row_limit"] = 10000000
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")

        # assert
        self.assert_row_count(rv, expected_row_count)
        assert "GROUP BY" not in rv.json["result"][0]["query"]

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @mock.patch(
        "superset.common.query_actions.config",
        {**app.config, "SAMPLES_ROW_LIMIT": 5, "SQL_MAX_ROW": 15},
    )
    def test_with_row_limit_as_samples__rowcount_as_row_limit(self):
        expected_row_count = 10
        self.query_context_payload["result_type"] = ChartDataResultType.SAMPLES
        self.query_context_payload["queries"][0]["row_limit"] = expected_row_count

        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")

        # assert
        self.assert_row_count(rv, expected_row_count)
        assert "GROUP BY" not in rv.json["result"][0]["query"]

    def test_with_incorrect_result_type__400(self):
        self.query_context_payload["result_type"] = "qwerty"
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")

        assert rv.status_code == 400

    def test_with_incorrect_result_format__400(self):
        self.query_context_payload["result_format"] = "qwerty"
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        assert rv.status_code == 400

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_with_invalid_payload__400(self):
        invalid_query_context = {"form_data": "NOT VALID JSON"}

        rv = self.client.post(
            CHART_DATA_URI,
            data=invalid_query_context,
            content_type="multipart/form-data",
        )

        assert rv.status_code == 400
        assert rv.json["message"] == "Request is not JSON"

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_with_query_result_type__200(self):
        self.query_context_payload["result_type"] = ChartDataResultType.QUERY
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        assert rv.status_code == 200

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_empty_request_with_csv_result_format(self):
        """
        Chart data API: Test empty chart data with CSV result format
        """
        self.query_context_payload["result_format"] = "csv"
        self.query_context_payload["queries"] = []
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        assert rv.status_code == 400

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_empty_request_with_excel_result_format(self):
        """
        Chart data API: Test empty chart data with Excel result format
        """
        self.query_context_payload["result_format"] = "xlsx"
        self.query_context_payload["queries"] = []
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        assert rv.status_code == 400

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_with_csv_result_format(self):
        """
        Chart data API: Test chart data with CSV result format
        """
        self.query_context_payload["result_format"] = "csv"
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        assert rv.status_code == 200
        assert rv.mimetype == "text/csv"

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_with_excel_result_format(self):
        """
        Chart data API: Test chart data with Excel result format
        """
        self.query_context_payload["result_format"] = "xlsx"
        mimetype = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        assert rv.status_code == 200
        assert rv.mimetype == mimetype

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_with_multi_query_csv_result_format(self):
        """
        Chart data API: Test chart data with multi-query CSV result format
        """
        self.query_context_payload["result_format"] = "csv"
        self.query_context_payload["queries"].append(
            self.query_context_payload["queries"][0]
        )
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        assert rv.status_code == 200
        assert rv.mimetype == "application/zip"
        zipfile = ZipFile(BytesIO(rv.data), "r")
        assert zipfile.namelist() == ["query_1.csv", "query_2.csv"]

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_with_multi_query_excel_result_format(self):
        """
        Chart data API: Test chart data with multi-query Excel result format
        """
        self.query_context_payload["result_format"] = "xlsx"
        self.query_context_payload["queries"].append(
            self.query_context_payload["queries"][0]
        )
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        assert rv.status_code == 200
        assert rv.mimetype == "application/zip"
        zipfile = ZipFile(BytesIO(rv.data), "r")
        assert zipfile.namelist() == ["query_1.xlsx", "query_2.xlsx"]

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_with_csv_result_format_when_actor_not_permitted_for_csv__403(self):
        """
        Chart data API: Test chart data with CSV result format
        """
        self.logout()
        self.login(GAMMA_NO_CSV_USERNAME)
        self.query_context_payload["result_format"] = "csv"

        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        assert rv.status_code == 403

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_with_excel_result_format_when_actor_not_permitted_for_excel__403(self):
        """
        Chart data API: Test chart data with Excel result format
        """
        self.logout()
        self.login(GAMMA_NO_CSV_USERNAME)
        self.query_context_payload["result_format"] = "xlsx"

        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        assert rv.status_code == 403

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_with_row_limit_and_offset__row_limit_and_offset_were_applied(self):
        """
        Chart data API: Test chart data query with limit and offset
        """
        self.query_context_payload["queries"][0]["row_limit"] = 5
        self.query_context_payload["queries"][0]["row_offset"] = 0
        self.query_context_payload["queries"][0]["orderby"] = [["name", True]]

        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        self.assert_row_count(rv, 5)
        result = rv.json["result"][0]

        # TODO: fix offset for presto DB
        if get_example_database().backend == "presto":
            return

        # ensure that offset works properly
        offset = 2
        expected_name = result["data"][offset]["name"]
        self.query_context_payload["queries"][0]["row_offset"] = offset
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        result = rv.json["result"][0]
        assert result["rowcount"] == 5
        assert result["data"][0]["name"] == expected_name

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_chart_data_applied_time_extras(self):
        """
        Chart data API: Test chart data query with applied time extras
        """
        self.query_context_payload["queries"][0]["applied_time_extras"] = {
            "__time_range": "100 years ago : now",
            "__time_origin": "now",
        }
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["result"][0]["applied_filters"] == [
            {"column": "gender"},
            {"column": "num"},
            {"column": "name"},
            {"column": "__time_range"},
        ]
        expected_row_count = self.get_expected_row_count("client_id_2")
        assert data["result"][0]["rowcount"] == expected_row_count

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_with_in_op_filter__data_is_returned(self):
        """
        Chart data API: Ensure mixed case filter operator generates valid result
        """
        expected_row_count = 10
        self.query_context_payload["queries"][0]["filters"][0]["op"] = "In"
        self.query_context_payload["queries"][0]["row_limit"] = expected_row_count
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")

        self.assert_row_count(rv, expected_row_count)

    @unittest.skip("Failing due to timezone difference")
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_chart_data_dttm_filter(self):
        """
        Chart data API: Ensure temporal column filter converts epoch to dttm expression
        """
        table = self.get_birth_names_dataset()
        if table.database.backend == "presto":
            # TODO: date handling on Presto not fully in line with other engine specs
            return

        self.query_context_payload["queries"][0]["time_range"] = ""
        dttm = self.get_dttm()
        ms_epoch = dttm.timestamp() * 1000
        self.query_context_payload["queries"][0]["filters"][0] = {
            "col": "ds",
            "op": "!=",
            "val": ms_epoch,
        }
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        response_payload = json.loads(rv.data.decode("utf-8"))
        result = response_payload["result"][0]

        # assert that unconverted timestamp is not present in query
        assert str(ms_epoch) not in result["query"]

        # assert that converted timestamp is present in query where supported
        dttm_col: Optional[TableColumn] = None
        for col in table.columns:
            if col.column_name == table.main_dttm_col:
                dttm_col = col
        if dttm_col:
            dttm_expression = table.database.db_engine_spec.convert_dttm(
                dttm_col.type,
                dttm,
            )
            assert dttm_expression in result["query"]
        else:
            raise Exception("ds column not found")

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_chart_data_prophet(self):
        """
        Chart data API: Ensure prophet post transformation works
        """
        if backend() == "hive":
            return

        time_grain = "P1Y"
        self.query_context_payload["queries"][0]["is_timeseries"] = True
        self.query_context_payload["queries"][0]["groupby"] = []
        self.query_context_payload["queries"][0]["extras"] = {
            "time_grain_sqla": time_grain
        }
        self.query_context_payload["queries"][0]["granularity"] = "ds"
        self.query_context_payload["queries"][0]["post_processing"] = [
            {
                "operation": "prophet",
                "options": {
                    "time_grain": time_grain,
                    "periods": 3,
                    "confidence_interval": 0.9,
                },
            }
        ]
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        assert rv.status_code == 200
        response_payload = json.loads(rv.data.decode("utf-8"))
        result = response_payload["result"][0]
        row = result["data"][0]
        assert "__timestamp" in row
        assert "sum__num" in row
        assert "sum__num__yhat" in row
        assert "sum__num__yhat_upper" in row
        assert "sum__num__yhat_lower" in row
        assert result["rowcount"] == 103

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_chart_data_invalid_post_processing(self):
        """
        Chart data API: Ensure incorrect post processing returns correct response
        """
        if backend() == "hive":
            return

        query_context = self.query_context_payload
        query = query_context["queries"][0]
        query["columns"] = ["name", "gender"]
        query["post_processing"] = [
            {
                "operation": "pivot",
                "options": {
                    "drop_missing_columns": False,
                    "columns": ["gender"],
                    "index": ["name"],
                    "aggregates": {},
                },
            },
        ]
        rv = self.post_assert_metric(CHART_DATA_URI, query_context, "data")
        assert rv.status_code == 400
        data = json.loads(rv.data.decode("utf-8"))
        assert (
            data["message"]
            == "Error: Pivot operation must include at least one aggregate"
        )

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_with_query_result_type_and_non_existent_filter__filter_omitted(self):
        self.query_context_payload["queries"][0]["filters"] = [
            {"col": "non_existent_filter", "op": "==", "val": "foo"},
        ]
        self.query_context_payload["result_type"] = ChartDataResultType.QUERY
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        assert rv.status_code == 200
        assert "non_existent_filter" not in rv.json["result"][0]["query"]

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_with_filter_suppose_to_return_empty_data__no_data_returned(self):
        self.query_context_payload["queries"][0]["filters"] = [
            {"col": "gender", "op": "==", "val": "foo"}
        ]
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")

        assert rv.status_code == 200
        assert rv.json["result"][0]["data"] == []
        self.assert_row_count(rv, 0)

    def test_with_invalid_where_parameter__400(self):
        self.query_context_payload["queries"][0]["filters"] = []
        # erroneous WHERE-clause
        self.query_context_payload["queries"][0]["extras"]["where"] = "(gender abc def)"

        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")

        assert rv.status_code == 400

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_with_invalid_where_parameter_closing_unclosed__400(self):
        self.query_context_payload["queries"][0]["filters"] = []
        self.query_context_payload["queries"][0]["extras"]["where"] = (
            "state = 'CA') OR (state = 'NY'"
        )

        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")

        assert rv.status_code == 400

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_with_where_parameter_including_comment___200(self):
        self.query_context_payload["queries"][0]["filters"] = []
        self.query_context_payload["queries"][0]["extras"]["where"] = "1 = 1 -- abc"

        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")

        assert rv.status_code == 200

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_with_orderby_parameter_with_second_query__400(self):
        self.query_context_payload["queries"][0]["filters"] = []
        self.query_context_payload["queries"][0]["orderby"] = [
            [
                {
                    "expressionType": "SQL",
                    "sqlExpression": "sum__num; select 1, 1",
                },
                True,
            ],
        ]
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")

        assert rv.status_code == 400

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_with_invalid_having_parameter_closing_and_comment__400(self):
        self.query_context_payload["queries"][0]["filters"] = []
        self.query_context_payload["queries"][0]["extras"]["having"] = (
            "COUNT(1) = 0) UNION ALL SELECT 'abc', 1--comment"
        )

        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")

        assert rv.status_code == 400

    def test_with_invalid_datasource__400(self):
        self.query_context_payload["datasource"] = "abc"

        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")

        assert rv.status_code == 400

    def test_with_not_permitted_actor__403(self):
        """
        Chart data API: Test chart data query not allowed
        """
        self.logout()
        self.login(GAMMA_USERNAME)
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")

        assert rv.status_code == 403
        assert (
            rv.json["errors"][0]["error_type"]
            == SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR
        )

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_when_where_parameter_is_template_and_query_result_type__query_is_templated(
        self,
    ):
        self.query_context_payload["result_type"] = ChartDataResultType.QUERY
        self.query_context_payload["queries"][0]["filters"] = [
            {"col": "gender", "op": "==", "val": "boy"}
        ]
        self.query_context_payload["queries"][0]["extras"]["where"] = (
            "('boy' = '{{ filter_values('gender', 'xyz' )[0] }}')"
        )
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        result = rv.json["result"][0]["query"]
        if get_example_database().backend != "presto":
            assert "('boy' = 'boy')" in result

    @unittest.skip("Extremely flaky test on MySQL")
    @with_feature_flags(GLOBAL_ASYNC_QUERIES=True)
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_chart_data_async(self):
        self.logout()
        app._got_first_request = False
        async_query_manager_factory.init_app(app)
        self.login(ADMIN_USERNAME)
        # Introducing time.sleep to make test less flaky with MySQL
        time.sleep(1)
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        time.sleep(1)
        assert rv.status_code == 202
        time.sleep(1)
        data = json.loads(rv.data.decode("utf-8"))
        keys = list(data.keys())
        self.assertCountEqual(  # noqa: PT009
            keys, ["channel_id", "job_id", "user_id", "status", "errors", "result_url"]
        )

    @with_feature_flags(GLOBAL_ASYNC_QUERIES=True)
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_chart_data_async_cached_sync_response(self):
        """
        Chart data API: Test chart data query returns results synchronously
        when results are already cached.
        """
        app._got_first_request = False
        async_query_manager_factory.init_app(app)

        class QueryContext:
            result_format = ChartDataResultFormat.JSON
            result_type = ChartDataResultType.FULL

        cmd_run_val = {
            "query_context": QueryContext(),
            "queries": [{"query": "select * from foo"}],
        }

        with mock.patch.object(
            ChartDataCommand, "run", return_value=cmd_run_val
        ) as patched_run:
            self.query_context_payload["result_type"] = ChartDataResultType.FULL
            rv = self.post_assert_metric(
                CHART_DATA_URI, self.query_context_payload, "data"
            )
            assert rv.status_code == 200
            data = json.loads(rv.data.decode("utf-8"))
            patched_run.assert_called_once_with(force_cached=True)
            assert data == {"result": [{"query": "select * from foo"}]}

    @with_feature_flags(GLOBAL_ASYNC_QUERIES=True)
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_chart_data_async_results_type(self):
        """
        Chart data API: Test chart data query non-JSON format (async)
        """
        app._got_first_request = False
        async_query_manager_factory.init_app(app)
        self.query_context_payload["result_type"] = "results"
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        assert rv.status_code == 200

    @with_feature_flags(GLOBAL_ASYNC_QUERIES=True)
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_chart_data_async_invalid_token(self):
        """
        Chart data API: Test chart data query (async)
        """
        app._got_first_request = False
        async_query_manager_factory.init_app(app)
        test_client.set_cookie(
            app.config["GLOBAL_ASYNC_QUERIES_JWT_COOKIE_NAME"], "foo"
        )
        rv = test_client.post(CHART_DATA_URI, json=self.query_context_payload)
        assert rv.status_code == 401

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_chart_data_rowcount(self):
        """
        Chart data API: Query total rows
        """
        expected_row_count = self.get_expected_row_count("client_id_4")
        self.query_context_payload["queries"][0]["is_rowcount"] = True
        self.query_context_payload["queries"][0]["groupby"] = ["name"]
        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")

        assert rv.json["result"][0]["data"][0]["rowcount"] == expected_row_count

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_with_timegrains_and_columns_result_types(self):
        """
        Chart data API: Query timegrains and columns
        """
        self.query_context_payload["queries"] = [
            {"result_type": ChartDataResultType.TIMEGRAINS},
            {"result_type": ChartDataResultType.COLUMNS},
        ]
        result = self.post_assert_metric(
            CHART_DATA_URI, self.query_context_payload, "data"
        ).json["result"]

        timegrain_data_keys = result[0]["data"][0].keys()
        column_data_keys = result[1]["data"][0].keys()
        assert list(timegrain_data_keys) == [
            "name",
            "function",
            "duration",
        ]
        assert list(column_data_keys) == [
            "column_name",
            "verbose_name",
            "dtype",
        ]

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_with_series_limit(self):
        SERIES_LIMIT = 5
        self.query_context_payload["queries"][0]["columns"] = ["state", "name"]
        self.query_context_payload["queries"][0]["series_columns"] = ["name"]
        self.query_context_payload["queries"][0]["series_limit"] = SERIES_LIMIT

        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")

        data = rv.json["result"][0]["data"]

        unique_names = {row["name"] for row in data}
        self.maxDiff = None
        assert len(unique_names) == SERIES_LIMIT
        assert {column for column in data[0].keys()} == {"state", "name", "sum__num"}

    @pytest.mark.usefixtures(
        "create_annotation_layers", "load_birth_names_dashboard_with_slices"
    )
    def test_with_annotations_layers__annotations_data_returned(self):
        """
        Chart data API: Test chart data query
        """

        annotation_layers = []
        self.query_context_payload["queries"][0]["annotation_layers"] = (
            annotation_layers
        )

        # formula
        annotation_layers.append(ANNOTATION_LAYERS[AnnotationType.FORMULA])

        # interval
        interval_layer = (
            db.session.query(AnnotationLayer)
            .filter(AnnotationLayer.name == "name1")
            .one()
        )
        interval = ANNOTATION_LAYERS[AnnotationType.INTERVAL]
        interval["value"] = interval_layer.id
        annotation_layers.append(interval)

        # event
        event_layer = (
            db.session.query(AnnotationLayer)
            .filter(AnnotationLayer.name == "name2")
            .one()
        )
        event = ANNOTATION_LAYERS[AnnotationType.EVENT]
        event["value"] = event_layer.id
        annotation_layers.append(event)

        rv = self.post_assert_metric(CHART_DATA_URI, self.query_context_payload, "data")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        # response should only contain interval and event data, not formula
        assert len(data["result"][0]["annotation_data"]) == 2

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_with_virtual_table_with_colons_as_datasource(self):
        """
        Chart data API: test query with literal colon characters in query, metrics,
        where clause and filters
        """
        owner = self.get_user("admin")
        table = SqlaTable(
            table_name="virtual_table_1",
            schema=get_example_default_schema(),
            owners=[owner],
            database=get_example_database(),
            sql="select ':foo' as foo, ':bar:' as bar, state, num from birth_names",
        )
        db.session.add(table)
        db.session.commit()
        table.fetch_metadata()

        request_payload = self.query_context_payload
        request_payload["datasource"] = {
            "type": "table",
            "id": table.id,
        }
        request_payload["queries"][0]["columns"] = ["foo", "bar", "state"]
        request_payload["queries"][0]["where"] = "':abc' != ':xyz:qwerty'"
        request_payload["queries"][0]["orderby"] = None
        request_payload["queries"][0]["metrics"] = [
            {
                "expressionType": AdhocMetricExpressionType.SQL,
                "sqlExpression": "sum(case when state = ':asdf' then 0 else 1 end)",
                "label": "count",
            }
        ]
        request_payload["queries"][0]["filters"] = [
            {
                "col": "foo",
                "op": "!=",
                "val": ":qwerty:",
            }
        ]

        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        db.session.delete(table)
        db.session.commit()
        assert rv.status_code == 200
        result = rv.json["result"][0]
        data = result["data"]
        assert {col for col in data[0].keys()} == {"foo", "bar", "state", "count"}
        # make sure results and query parameters are unescaped
        assert {row["foo"] for row in data} == {":foo"}
        assert {row["bar"] for row in data} == {":bar:"}
        assert "':asdf'" in result["query"]
        assert "':xyz:qwerty'" in result["query"]
        assert "':qwerty:'" in result["query"]

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_with_table_columns_without_metrics(self):
        request_payload = self.query_context_payload
        request_payload["queries"][0]["columns"] = ["name", "gender"]
        request_payload["queries"][0]["metrics"] = None
        request_payload["queries"][0]["orderby"] = []

        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        result = rv.json["result"][0]

        assert rv.status_code == 200
        assert "name" in result["colnames"]
        assert "gender" in result["colnames"]
        assert "name" in result["query"]
        assert "gender" in result["query"]
        assert list(result["data"][0].keys()) == ["name", "gender"]

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_with_adhoc_column_without_metrics(self):
        request_payload = self.query_context_payload
        request_payload["queries"][0]["columns"] = [
            "name",
            {
                "label": "num divide by 10",
                "sqlExpression": "num/10",
                "expressionType": "SQL",
            },
        ]
        request_payload["queries"][0]["metrics"] = None
        request_payload["queries"][0]["orderby"] = []

        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        result = rv.json["result"][0]

        assert rv.status_code == 200
        assert "num divide by 10" in result["colnames"]
        assert "name" in result["colnames"]
        assert "num divide by 10" in result["query"]
        assert "name" in result["query"]
        assert list(result["data"][0].keys()) == ["name", "num divide by 10"]


@pytest.mark.chart_data_flow
class TestGetChartDataApi(BaseTestChartDataApi):
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_get_data_when_query_context_is_null(self):
        """
        Chart data API: Test GET endpoint when query context is null
        """
        chart = db.session.query(Slice).filter_by(slice_name="Genders").one()
        rv = self.get_assert_metric(f"api/v1/chart/{chart.id}/data/", "get_data")
        data = json.loads(rv.data.decode("utf-8"))
        assert data == {
            "message": "Chart has no query context saved. Please save the chart again."
        }

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_chart_data_get(self):
        """
        Chart data API: Test GET endpoint
        """
        chart = db.session.query(Slice).filter_by(slice_name="Genders").one()
        chart.query_context = json.dumps(
            {
                "datasource": {"id": chart.table.id, "type": "table"},
                "force": False,
                "queries": [
                    {
                        "time_range": "1900-01-01T00:00:00 : 2000-01-01T00:00:00",
                        "granularity": "ds",
                        "filters": [],
                        "extras": {
                            "having": "",
                            "where": "",
                        },
                        "applied_time_extras": {},
                        "columns": ["gender"],
                        "metrics": ["sum__num"],
                        "orderby": [["sum__num", False]],
                        "annotation_layers": [],
                        "row_limit": 50000,
                        "timeseries_limit": 0,
                        "order_desc": True,
                        "url_params": {},
                        "custom_params": {},
                        "custom_form_data": {},
                    }
                ],
                "result_format": "json",
                "result_type": "full",
            }
        )
        rv = self.get_assert_metric(f"api/v1/chart/{chart.id}/data/", "get_data")
        assert rv.mimetype == "application/json"
        data = json.loads(rv.data.decode("utf-8"))
        assert data["result"][0]["status"] == "success"
        assert data["result"][0]["rowcount"] == 2

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_chart_data_get_with_x_axis_using_custom_sql(self):
        """
        Chart data API: Test GET endpoint
        """
        chart = db.session.query(Slice).filter_by(slice_name="Genders").one()
        chart.query_context = json.dumps(
            {
                "datasource": {"id": chart.table.id, "type": "table"},
                "force": False,
                "queries": [
                    {
                        "time_range": "1900-01-01T00:00:00 : 2000-01-01T00:00:00",
                        "granularity": "ds",
                        "filters": [
                            {"col": "ds", "op": "TEMPORAL_RANGE", "val": "No filter"}
                        ],
                        "extras": {
                            "having": "",
                            "where": "",
                        },
                        "applied_time_extras": {},
                        "columns": [
                            {
                                "columnType": "BASE_AXIS",
                                "datasourceWarning": False,
                                "expressionType": "SQL",
                                "label": "My column",
                                "sqlExpression": "ds",
                                "timeGrain": "P1W",
                            }
                        ],
                        "metrics": ["sum__num"],
                        "orderby": [["sum__num", False]],
                        "annotation_layers": [],
                        "row_limit": 50000,
                        "timeseries_limit": 0,
                        "order_desc": True,
                        "url_params": {},
                        "custom_params": {},
                        "custom_form_data": {},
                    }
                ],
                "form_data": {
                    "x_axis": {
                        "datasourceWarning": False,
                        "expressionType": "SQL",
                        "label": "My column",
                        "sqlExpression": "ds",
                    }
                },
                "result_format": "json",
                "result_type": "full",
            }
        )
        rv = self.get_assert_metric(f"api/v1/chart/{chart.id}/data/", "get_data")
        assert rv.mimetype == "application/json"
        data = json.loads(rv.data.decode("utf-8"))
        assert data["result"][0]["status"] == "success"

        if backend() == "presto":
            assert data["result"][0]["rowcount"] == 41
        else:
            assert data["result"][0]["rowcount"] == 40

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_chart_data_get_forced(self):
        """
        Chart data API: Test GET endpoint with force cache parameter
        """
        chart = db.session.query(Slice).filter_by(slice_name="Genders").one()
        chart.query_context = json.dumps(
            {
                "datasource": {"id": chart.table.id, "type": "table"},
                "force": False,
                "queries": [
                    {
                        "time_range": "1900-01-01T00:00:00 : 2000-01-01T00:00:00",
                        "granularity": "ds",
                        "filters": [],
                        "extras": {
                            "having": "",
                            "where": "",
                        },
                        "applied_time_extras": {},
                        "columns": ["gender"],
                        "metrics": ["sum__num"],
                        "orderby": [["sum__num", False]],
                        "annotation_layers": [],
                        "row_limit": 50000,
                        "timeseries_limit": 0,
                        "order_desc": True,
                        "url_params": {},
                        "custom_params": {},
                        "custom_form_data": {},
                    }
                ],
                "result_format": "json",
                "result_type": "full",
            }
        )

        self.get_assert_metric(f"api/v1/chart/{chart.id}/data/?force=true", "get_data")

        # should burst cache
        rv = self.get_assert_metric(
            f"api/v1/chart/{chart.id}/data/?force=true", "get_data"
        )
        assert rv.json["result"][0]["is_cached"] is None

        # should get response from the cache
        rv = self.get_assert_metric(f"api/v1/chart/{chart.id}/data/", "get_data")
        assert rv.json["result"][0]["is_cached"]

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(GLOBAL_ASYNC_QUERIES=True)
    @mock.patch("superset.charts.data.api.QueryContextCacheLoader")
    def test_chart_data_cache(self, cache_loader):
        """
        Chart data cache API: Test chart data async cache request
        """
        app._got_first_request = False
        async_query_manager_factory.init_app(app)
        cache_loader.load.return_value = self.query_context_payload
        orig_run = ChartDataCommand.run

        def mock_run(self, **kwargs):
            assert kwargs["force_cached"] is True  # noqa: E712
            # override force_cached to get result from DB
            return orig_run(self, force_cached=False)

        with mock.patch.object(ChartDataCommand, "run", new=mock_run):
            rv = self.get_assert_metric(
                f"{CHART_DATA_URI}/test-cache-key", "data_from_cache"
            )
            data = json.loads(rv.data.decode("utf-8"))

        expected_row_count = self.get_expected_row_count("client_id_3")
        assert rv.status_code == 200
        assert data["result"][0]["rowcount"] == expected_row_count

    @with_feature_flags(GLOBAL_ASYNC_QUERIES=True)
    @mock.patch("superset.charts.data.api.QueryContextCacheLoader")
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_chart_data_cache_run_failed(self, cache_loader):
        """
        Chart data cache API: Test chart data async cache request with run failure
        """
        app._got_first_request = False
        async_query_manager_factory.init_app(app)
        cache_loader.load.return_value = self.query_context_payload
        rv = self.get_assert_metric(
            f"{CHART_DATA_URI}/test-cache-key", "data_from_cache"
        )
        data = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 422
        assert data["message"] == "Error loading data from cache"

    @with_feature_flags(GLOBAL_ASYNC_QUERIES=True)
    @mock.patch("superset.charts.data.api.QueryContextCacheLoader")
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_chart_data_cache_no_login(self, cache_loader):
        """
        Chart data cache API: Test chart data async cache request (no login)
        """
        if get_example_database().backend == "presto":
            return

        app._got_first_request = False
        async_query_manager_factory.init_app(app)
        self.logout()
        cache_loader.load.return_value = self.query_context_payload
        orig_run = ChartDataCommand.run

        def mock_run(self, **kwargs):
            assert kwargs["force_cached"] is True  # noqa: E712
            # override force_cached to get result from DB
            return orig_run(self, force_cached=False)

        with mock.patch.object(ChartDataCommand, "run", new=mock_run):
            rv = self.client.get(
                f"{CHART_DATA_URI}/test-cache-key",
            )

        assert rv.status_code == 401

    @with_feature_flags(GLOBAL_ASYNC_QUERIES=True)
    def test_chart_data_cache_key_error(self):
        """
        Chart data cache API: Test chart data async cache request with invalid cache key
        """
        app._got_first_request = False
        async_query_manager_factory.init_app(app)
        rv = self.get_assert_metric(
            f"{CHART_DATA_URI}/test-cache-key", "data_from_cache"
        )

        assert rv.status_code == 404

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_chart_data_with_adhoc_column(self):
        """
        Chart data API: Test query with adhoc column in both select and where clause
        """
        request_payload = get_query_context("birth_names")
        request_payload["queries"][0]["columns"] = [ADHOC_COLUMN_FIXTURE]
        request_payload["queries"][0]["filters"] = [
            {"col": ADHOC_COLUMN_FIXTURE, "op": "IN", "val": ["male", "female"]}
        ]
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        response_payload = json.loads(rv.data.decode("utf-8"))
        result = response_payload["result"][0]
        data = result["data"]
        assert {column for column in data[0].keys()} == {"male_or_female", "sum__num"}
        unique_genders = {row["male_or_female"] for row in data}
        assert unique_genders == {"male", "female"}
        assert result["applied_filters"] == [{"column": "male_or_female"}]

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_chart_data_with_incompatible_adhoc_column(self):
        """
        Chart data API: Test query with adhoc column that fails to run on this dataset
        """
        request_payload = get_query_context("birth_names")
        request_payload["queries"][0]["columns"] = [ADHOC_COLUMN_FIXTURE]
        request_payload["queries"][0]["filters"] = [
            {"col": INCOMPATIBLE_ADHOC_COLUMN_FIXTURE, "op": "IN", "val": ["Exciting"]},
            {"col": ADHOC_COLUMN_FIXTURE, "op": "IN", "val": ["male", "female"]},
        ]
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        response_payload = json.loads(rv.data.decode("utf-8"))
        result = response_payload["result"][0]
        data = result["data"]
        assert {column for column in data[0].keys()} == {"male_or_female", "sum__num"}
        unique_genders = {row["male_or_female"] for row in data}
        assert unique_genders == {"male", "female"}
        assert result["applied_filters"] == [{"column": "male_or_female"}]
        assert result["rejected_filters"] == [
            {
                "column": "exciting_or_boring",
                "reason": ExtraFiltersReasonType.COL_NOT_IN_DATASOURCE,
            }
        ]


@pytest.fixture()
def physical_query_context(physical_dataset) -> dict[str, Any]:
    return {
        "datasource": {
            "type": physical_dataset.type,
            "id": physical_dataset.id,
        },
        "queries": [
            {
                "columns": ["col1"],
                "metrics": ["count"],
                "orderby": [["col1", True]],
            }
        ],
        "result_type": ChartDataResultType.FULL,
        "force": True,
    }


@mock.patch(
    "superset.common.query_context_processor.config",
    {
        **app.config,
        "CACHE_DEFAULT_TIMEOUT": 1234,
        "DATA_CACHE_CONFIG": {
            **app.config["DATA_CACHE_CONFIG"],
            "CACHE_DEFAULT_TIMEOUT": None,
        },
    },
)
def test_cache_default_timeout(test_client, login_as_admin, physical_query_context):
    rv = test_client.post(CHART_DATA_URI, json=physical_query_context)
    assert rv.json["result"][0]["cache_timeout"] == 1234


def test_custom_cache_timeout(test_client, login_as_admin, physical_query_context):
    physical_query_context["custom_cache_timeout"] = 5678
    rv = test_client.post(CHART_DATA_URI, json=physical_query_context)
    assert rv.json["result"][0]["cache_timeout"] == 5678


def test_time_filter_with_grain(test_client, login_as_admin, physical_query_context):
    physical_query_context["queries"][0]["filters"] = [
        {
            "col": "col5",
            "op": "TEMPORAL_RANGE",
            "val": "Last quarter : ",
            "grain": "P1W",
        },
    ]
    rv = test_client.post(CHART_DATA_URI, json=physical_query_context)
    query = rv.json["result"][0]["query"]
    backend = get_example_database().backend
    if backend == "sqlite":
        assert (
            "DATETIME(col5, 'start of day',             -strftime('%w', col5) || ' days') >="
            in query
        )
    elif backend == "mysql":
        assert "DATE(DATE_SUB(col5, INTERVAL DAYOFWEEK(col5) - 1 DAY)) >=" in query
    elif backend == "postgresql":
        assert "DATE_TRUNC('week', col5) >=" in query
    elif backend == "presto":
        assert "date_trunc('week', CAST(col5 AS TIMESTAMP)) >=" in query


def test_force_cache_timeout(test_client, login_as_admin, physical_query_context):
    physical_query_context["custom_cache_timeout"] = -1
    test_client.post(CHART_DATA_URI, json=physical_query_context)
    rv = test_client.post(CHART_DATA_URI, json=physical_query_context)
    assert rv.json["result"][0]["cached_dttm"] is None
    assert rv.json["result"][0]["is_cached"] is None


@mock.patch(
    "superset.common.query_context_processor.config",
    {
        **app.config,
        "CACHE_DEFAULT_TIMEOUT": 100000,
        "DATA_CACHE_CONFIG": {
            **app.config["DATA_CACHE_CONFIG"],
            "CACHE_DEFAULT_TIMEOUT": 3456,
        },
    },
)
def test_data_cache_default_timeout(
    test_client,
    login_as_admin,
    physical_query_context,
):
    rv = test_client.post(CHART_DATA_URI, json=physical_query_context)
    assert rv.json["result"][0]["cache_timeout"] == 3456


def test_chart_cache_timeout(
    load_energy_table_with_slice: list[Slice],  # noqa: F811
    test_client,
    login_as_admin,
    physical_query_context,
):
    # should override datasource cache timeout

    slice_with_cache_timeout = load_energy_table_with_slice[0]
    slice_with_cache_timeout.cache_timeout = 20

    datasource: SqlaTable = (
        db.session.query(SqlaTable)
        .filter(SqlaTable.id == physical_query_context["datasource"]["id"])
        .first()
    )
    datasource.cache_timeout = 1254

    db.session.commit()

    physical_query_context["form_data"] = {"slice_id": slice_with_cache_timeout.id}
    rv = test_client.post(CHART_DATA_URI, json=physical_query_context)
    assert rv.json["result"][0]["cache_timeout"] == 20


@mock.patch(
    "superset.common.query_context_processor.config",
    {
        **app.config,
        "DATA_CACHE_CONFIG": {
            **app.config["DATA_CACHE_CONFIG"],
            "CACHE_DEFAULT_TIMEOUT": 1010,
        },
    },
)
def test_chart_cache_timeout_not_present(
    test_client, login_as_admin, physical_query_context
):
    # should use datasource cache, if it's present

    datasource: SqlaTable = (
        db.session.query(SqlaTable)
        .filter(SqlaTable.id == physical_query_context["datasource"]["id"])
        .first()
    )
    datasource.cache_timeout = 1980
    db.session.commit()

    rv = test_client.post(CHART_DATA_URI, json=physical_query_context)
    assert rv.json["result"][0]["cache_timeout"] == 1980


@mock.patch(
    "superset.common.query_context_processor.config",
    {
        **app.config,
        "DATA_CACHE_CONFIG": {
            **app.config["DATA_CACHE_CONFIG"],
            "CACHE_DEFAULT_TIMEOUT": 1010,
        },
    },
)
def test_chart_cache_timeout_chart_not_found(
    test_client, login_as_admin, physical_query_context
):
    # should use default timeout

    physical_query_context["form_data"] = {"slice_id": 0}

    rv = test_client.post(CHART_DATA_URI, json=physical_query_context)
    assert rv.json["result"][0]["cache_timeout"] == 1010


@pytest.mark.parametrize(
    "status_code,extras",
    [
        (200, {"where": "1 = 1"}),
        (200, {"having": "count(*) > 0"}),
        (403, {"where": "col1 in (select distinct col1 from physical_dataset)"}),
        (403, {"having": "count(*) > (select count(*) from physical_dataset)"}),
    ],
)
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=False)
@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
def test_chart_data_subquery_not_allowed(
    test_client,
    login_as_admin,
    physical_dataset,
    physical_query_context,
    status_code,
    extras,
):
    physical_query_context["queries"][0]["extras"] = extras
    rv = test_client.post(CHART_DATA_URI, json=physical_query_context)

    assert rv.status_code == status_code


@pytest.mark.parametrize(
    "status_code,extras",
    [
        (200, {"where": "1 = 1"}),
        (200, {"having": "count(*) > 0"}),
        (200, {"where": "col1 in (select distinct col1 from physical_dataset)"}),
        (200, {"having": "count(*) > (select count(*) from physical_dataset)"}),
    ],
)
@with_feature_flags(ALLOW_ADHOC_SUBQUERY=True)
@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
def test_chart_data_subquery_allowed(
    test_client,
    login_as_admin,
    physical_dataset,
    physical_query_context,
    status_code,
    extras,
):
    physical_query_context["queries"][0]["extras"] = extras
    rv = test_client.post(CHART_DATA_URI, json=physical_query_context)

    assert rv.status_code == status_code
