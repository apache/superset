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
import re
import time
from typing import Any, Dict

import numpy as np
import pandas as pd
import pytest
from pandas import DateOffset

from superset import db
from superset.charts.schemas import ChartDataQueryContextSchema
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context import QueryContext
from superset.common.query_context_factory import QueryContextFactory
from superset.common.query_object import QueryObject
from superset.connectors.sqla.models import SqlMetric
from superset.datasource.dao import DatasourceDAO
from superset.extensions import cache_manager
from superset.superset_typing import AdhocColumn
from superset.utils.core import (
    AdhocMetricExpressionType,
    backend,
    DatasourceType,
    QueryStatus,
)
from superset.utils.pandas_postprocessing.utils import FLAT_COLUMN_SEPARATOR
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import only_postgresql, only_sqlite
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)
from tests.integration_tests.fixtures.query_context import get_query_context


def get_sql_text(payload: Dict[str, Any]) -> str:
    payload["result_type"] = ChartDataResultType.QUERY.value
    query_context = ChartDataQueryContextSchema().load(payload)
    responses = query_context.get_payload()
    assert len(responses) == 1
    response = responses["queries"][0]
    assert len(response) == 2
    assert response["language"] == "sql"
    return response["query"]


class TestQueryContext(SupersetTestCase):
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_schema_deserialization(self):
        """
        Ensure that the deserialized QueryContext contains all required fields.
        """

        payload = get_query_context("birth_names", add_postprocessing_operations=True)
        query_context = ChartDataQueryContextSchema().load(payload)
        self.assertEqual(len(query_context.queries), len(payload["queries"]))

        for query_idx, query in enumerate(query_context.queries):
            payload_query = payload["queries"][query_idx]

            # check basic properies
            self.assertEqual(query.extras, payload_query["extras"])
            self.assertEqual(query.filter, payload_query["filters"])
            self.assertEqual(query.columns, payload_query["columns"])

            # metrics are mutated during creation
            for metric_idx, metric in enumerate(query.metrics):
                payload_metric = payload_query["metrics"][metric_idx]
                payload_metric = (
                    payload_metric
                    if "expressionType" in payload_metric
                    else payload_metric["label"]
                )
                self.assertEqual(metric, payload_metric)

            self.assertEqual(query.orderby, payload_query["orderby"])
            self.assertEqual(query.time_range, payload_query["time_range"])

            # check post processing operation properties
            for post_proc_idx, post_proc in enumerate(query.post_processing):
                payload_post_proc = payload_query["post_processing"][post_proc_idx]
                self.assertEqual(post_proc["operation"], payload_post_proc["operation"])
                self.assertEqual(post_proc["options"], payload_post_proc["options"])

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_cache(self):
        table_name = "birth_names"
        payload = get_query_context(
            query_name=table_name,
            add_postprocessing_operations=True,
        )
        payload["force"] = True

        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        query_cache_key = query_context.query_cache_key(query_object)

        response = query_context.get_payload(cache_query_context=True)
        # MUST BE a successful query
        query_dump = response["queries"][0]
        assert query_dump["status"] == QueryStatus.SUCCESS

        cache_key = response["cache_key"]
        assert cache_key is not None

        cached = cache_manager.cache.get(cache_key)
        assert cached is not None

        rehydrated_qc = ChartDataQueryContextSchema().load(cached["data"])
        rehydrated_qo = rehydrated_qc.queries[0]
        rehydrated_query_cache_key = rehydrated_qc.query_cache_key(rehydrated_qo)

        self.assertEqual(rehydrated_qc.datasource, query_context.datasource)
        self.assertEqual(len(rehydrated_qc.queries), 1)
        self.assertEqual(query_cache_key, rehydrated_query_cache_key)
        self.assertEqual(rehydrated_qc.result_type, query_context.result_type)
        self.assertEqual(rehydrated_qc.result_format, query_context.result_format)
        self.assertFalse(rehydrated_qc.force)

    def test_query_cache_key_changes_when_datasource_is_updated(self):
        self.login(username="admin")
        payload = get_query_context("birth_names")

        # construct baseline query_cache_key
        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        cache_key_original = query_context.query_cache_key(query_object)

        # make temporary change and revert it to refresh the changed_on property
        datasource = DatasourceDAO.get_datasource(
            session=db.session,
            datasource_type=DatasourceType(payload["datasource"]["type"]),
            datasource_id=payload["datasource"]["id"],
        )
        description_original = datasource.description
        datasource.description = "temporary description"
        db.session.commit()
        datasource.description = description_original
        db.session.commit()

        # create new QueryContext with unchanged attributes, extract new query_cache_key
        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        cache_key_new = query_context.query_cache_key(query_object)

        # the new cache_key should be different due to updated datasource
        self.assertNotEqual(cache_key_original, cache_key_new)

    def test_query_cache_key_changes_when_metric_is_updated(self):
        self.login(username="admin")
        payload = get_query_context("birth_names")

        # make temporary change and revert it to refresh the changed_on property
        datasource = DatasourceDAO.get_datasource(
            session=db.session,
            datasource_type=DatasourceType(payload["datasource"]["type"]),
            datasource_id=payload["datasource"]["id"],
        )

        datasource.metrics.append(SqlMetric(metric_name="foo", expression="select 1;"))
        db.session.commit()

        # construct baseline query_cache_key
        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        cache_key_original = query_context.query_cache_key(query_object)

        # wait a second since mysql records timestamps in second granularity
        time.sleep(1)

        datasource.metrics[0].expression = "select 2;"
        db.session.commit()

        # create new QueryContext with unchanged attributes, extract new query_cache_key
        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        cache_key_new = query_context.query_cache_key(query_object)

        datasource.metrics = []
        db.session.commit()

        # the new cache_key should be different due to updated datasource
        self.assertNotEqual(cache_key_original, cache_key_new)

    def test_query_cache_key_does_not_change_for_non_existent_or_null(self):
        self.login(username="admin")
        payload = get_query_context("birth_names", add_postprocessing_operations=True)
        del payload["queries"][0]["granularity"]

        # construct baseline query_cache_key from query_context with post processing operation
        query_context: QueryContext = ChartDataQueryContextSchema().load(payload)
        query_object: QueryObject = query_context.queries[0]
        cache_key_original = query_context.query_cache_key(query_object)

        payload["queries"][0]["granularity"] = None
        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]

        assert query_context.query_cache_key(query_object) == cache_key_original

    def test_query_cache_key_changes_when_post_processing_is_updated(self):
        self.login(username="admin")
        payload = get_query_context("birth_names", add_postprocessing_operations=True)

        # construct baseline query_cache_key from query_context with post processing operation
        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        cache_key_original = query_context.query_cache_key(query_object)

        # ensure added None post_processing operation doesn't change query_cache_key
        payload["queries"][0]["post_processing"].append(None)
        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        cache_key = query_context.query_cache_key(query_object)
        self.assertEqual(cache_key_original, cache_key)

        # ensure query without post processing operation is different
        payload["queries"][0].pop("post_processing")
        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        cache_key = query_context.query_cache_key(query_object)
        self.assertNotEqual(cache_key_original, cache_key)

    def test_query_cache_key_changes_when_time_offsets_is_updated(self):
        self.login(username="admin")
        payload = get_query_context("birth_names", add_time_offsets=True)

        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        cache_key_original = query_context.query_cache_key(query_object)

        payload["queries"][0]["time_offsets"].pop()
        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        cache_key = query_context.query_cache_key(query_object)
        self.assertNotEqual(cache_key_original, cache_key)

    def test_handle_metrics_field(self):
        """
        Should support both predefined and adhoc metrics.
        """
        self.login(username="admin")
        adhoc_metric = {
            "expressionType": "SIMPLE",
            "column": {"column_name": "num_boys", "type": "BIGINT(20)"},
            "aggregate": "SUM",
            "label": "Boys",
            "optionName": "metric_11",
        }
        payload = get_query_context("birth_names")
        payload["queries"][0]["metrics"] = ["sum__num", {"label": "abc"}, adhoc_metric]
        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        self.assertEqual(query_object.metrics, ["sum__num", "abc", adhoc_metric])

    def test_convert_deprecated_fields(self):
        """
        Ensure that deprecated fields are converted correctly
        """
        self.login(username="admin")
        payload = get_query_context("birth_names")
        columns = payload["queries"][0]["columns"]
        payload["queries"][0]["groupby"] = columns
        payload["queries"][0]["timeseries_limit"] = 99
        payload["queries"][0]["timeseries_limit_metric"] = "sum__num"
        del payload["queries"][0]["columns"]
        payload["queries"][0]["granularity_sqla"] = "timecol"
        payload["queries"][0]["having_filters"] = [{"col": "a", "op": "==", "val": "b"}]
        query_context = ChartDataQueryContextSchema().load(payload)
        self.assertEqual(len(query_context.queries), 1)
        query_object = query_context.queries[0]
        self.assertEqual(query_object.granularity, "timecol")
        self.assertEqual(query_object.columns, columns)
        self.assertEqual(query_object.series_limit, 99)
        self.assertEqual(query_object.series_limit_metric, "sum__num")

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_csv_response_format(self):
        """
        Ensure that CSV result format works
        """
        self.login(username="admin")
        payload = get_query_context("birth_names")
        payload["result_format"] = ChartDataResultFormat.CSV.value
        payload["queries"][0]["row_limit"] = 10
        query_context: QueryContext = ChartDataQueryContextSchema().load(payload)
        responses = query_context.get_payload()
        self.assertEqual(len(responses), 1)
        data = responses["queries"][0]["data"]
        self.assertIn("name,sum__num\n", data)
        self.assertEqual(len(data.split("\n")), 12)

    def test_sql_injection_via_groupby(self):
        """
        Ensure that calling invalid columns names in groupby are caught
        """
        self.login(username="admin")
        payload = get_query_context("birth_names")
        payload["queries"][0]["groupby"] = ["currentDatabase()"]
        query_context = ChartDataQueryContextSchema().load(payload)
        query_payload = query_context.get_payload()
        assert query_payload["queries"][0].get("error") is not None

    def test_sql_injection_via_columns(self):
        """
        Ensure that calling invalid column names in columns are caught
        """
        self.login(username="admin")
        payload = get_query_context("birth_names")
        payload["queries"][0]["groupby"] = []
        payload["queries"][0]["metrics"] = []
        payload["queries"][0]["columns"] = ["*, 'extra'"]
        query_context = ChartDataQueryContextSchema().load(payload)
        query_payload = query_context.get_payload()
        assert query_payload["queries"][0].get("error") is not None

    def test_sql_injection_via_metrics(self):
        """
        Ensure that calling invalid column names in filters are caught
        """
        self.login(username="admin")
        payload = get_query_context("birth_names")
        payload["queries"][0]["groupby"] = ["name"]
        payload["queries"][0]["metrics"] = [
            {
                "expressionType": AdhocMetricExpressionType.SIMPLE.value,
                "column": {"column_name": "invalid_col"},
                "aggregate": "SUM",
                "label": "My Simple Label",
            }
        ]
        query_context = ChartDataQueryContextSchema().load(payload)
        query_payload = query_context.get_payload()
        assert query_payload["queries"][0].get("error") is not None

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_samples_response_type(self):
        """
        Ensure that samples result type works
        """
        self.login(username="admin")
        payload = get_query_context("birth_names")
        payload["result_type"] = ChartDataResultType.SAMPLES.value
        payload["queries"][0]["row_limit"] = 5
        query_context = ChartDataQueryContextSchema().load(payload)
        responses = query_context.get_payload()
        self.assertEqual(len(responses), 1)
        data = responses["queries"][0]["data"]
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 5)
        self.assertNotIn("sum__num", data[0])

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_query_response_type(self):
        """
        Ensure that query result type works
        """
        self.login(username="admin")
        payload = get_query_context("birth_names")
        sql_text = get_sql_text(payload)
        assert "SELECT" in sql_text
        assert re.search(r'[`"\[]?num[`"\]]? IS NOT NULL', sql_text)
        assert re.search(
            r"""NOT \([`"\[]?name[`"\]]? IS NULL[\s\n]* """
            r"""OR [`"\[]?name[`"\]]? IN \('"abc"'\)\)""",
            sql_text,
        )

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_handle_sort_by_metrics(self):
        """
        Should properly handle sort by metrics in various scenarios.
        """
        self.login(username="admin")

        sql_text = get_sql_text(get_query_context("birth_names"))
        if backend() == "hive":
            # should have no duplicate `SUM(num)`
            assert "SUM(num) AS `sum__num`," not in sql_text
            assert "SUM(num) AS `sum__num`" in sql_text
            # the alias should be in ORDER BY
            assert "ORDER BY `sum__num` DESC" in sql_text
        else:
            assert re.search(r'ORDER BY [`"\[]?sum__num[`"\]]? DESC', sql_text)

        sql_text = get_sql_text(
            get_query_context("birth_names:only_orderby_has_metric")
        )
        if backend() == "hive":
            assert "SUM(num) AS `sum__num`," not in sql_text
            assert "SUM(num) AS `sum__num`" in sql_text
            assert "ORDER BY `sum__num` DESC" in sql_text
        else:
            assert re.search(
                r'ORDER BY SUM\([`"\[]?num[`"\]]?\) DESC', sql_text, re.IGNORECASE
            )

        sql_text = get_sql_text(get_query_context("birth_names:orderby_dup_alias"))

        # Check SELECT clauses
        if backend() == "presto":
            # presto cannot have ambiguous alias in order by, so selected column
            # alias is renamed.
            assert 'sum("num_boys") AS "num_boys__"' in sql_text
        else:
            assert re.search(
                r'SUM\([`"\[]?num_boys[`"\]]?\) AS [`\"\[]?num_boys[`"\]]?',
                sql_text,
                re.IGNORECASE,
            )

        # Check ORDER BY clauses
        if backend() == "hive":
            # Hive must add additional SORT BY metrics to SELECT
            assert re.search(
                r"MAX\(CASE.*END\) AS `MAX\(CASE WHEN...`",
                sql_text,
                re.IGNORECASE | re.DOTALL,
            )

            # The additional column with the same expression but a different label
            # as an existing metric should not be added
            assert "sum(`num_girls`) AS `SUM(num_girls)`" not in sql_text

            # Should reference all ORDER BY columns by aliases
            assert "ORDER BY `num_girls` DESC," in sql_text
            assert "`AVG(num_boys)` DESC," in sql_text
            assert "`MAX(CASE WHEN...` ASC" in sql_text
        else:
            if backend() == "presto":
                # since the selected `num_boys` is renamed to `num_boys__`
                # it must be references as expression
                assert re.search(
                    r'ORDER BY SUM\([`"\[]?num_girls[`"\]]?\) DESC',
                    sql_text,
                    re.IGNORECASE,
                )
            else:
                # Should reference the adhoc metric by alias when possible
                assert re.search(
                    r'ORDER BY [`"\[]?num_girls[`"\]]? DESC',
                    sql_text,
                    re.IGNORECASE,
                )

            # ORDER BY only columns should always be expressions
            assert re.search(
                r'AVG\([`"\[]?num_boys[`"\]]?\) DESC',
                sql_text,
                re.IGNORECASE,
            )
            assert re.search(
                r"MAX\(CASE.*END\) ASC", sql_text, re.IGNORECASE | re.DOTALL
            )

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_fetch_values_predicate(self):
        """
        Ensure that fetch values predicate is added to query if needed
        """
        self.login(username="admin")

        payload = get_query_context("birth_names")
        sql_text = get_sql_text(payload)
        assert "123 = 123" not in sql_text

        payload["queries"][0]["apply_fetch_values_predicate"] = True
        sql_text = get_sql_text(payload)
        assert "123 = 123" in sql_text

    def test_query_object_unknown_fields(self):
        """
        Ensure that query objects with unknown fields don't raise an Exception and
        have an identical cache key as one without the unknown field
        """
        self.login(username="admin")
        payload = get_query_context("birth_names")
        query_context = ChartDataQueryContextSchema().load(payload)
        responses = query_context.get_payload()
        orig_cache_key = responses["queries"][0]["cache_key"]
        payload["queries"][0]["foo"] = "bar"
        query_context = ChartDataQueryContextSchema().load(payload)
        responses = query_context.get_payload()
        new_cache_key = responses["queries"][0]["cache_key"]
        self.assertEqual(orig_cache_key, new_cache_key)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_time_offsets_in_query_object(self):
        """
        Ensure that time_offsets can generate the correct query
        """
        self.login(username="admin")
        payload = get_query_context("birth_names")
        payload["queries"][0]["metrics"] = ["sum__num"]
        payload["queries"][0]["groupby"] = ["name"]
        payload["queries"][0]["is_timeseries"] = True
        payload["queries"][0]["timeseries_limit"] = 5
        payload["queries"][0]["time_offsets"] = ["1 year ago", "1 year later"]
        payload["queries"][0]["time_range"] = "1990 : 1991"
        query_context = ChartDataQueryContextSchema().load(payload)
        responses = query_context.get_payload()
        self.assertEqual(
            responses["queries"][0]["colnames"],
            [
                "__timestamp",
                "name",
                "sum__num",
                "sum__num__1 year ago",
                "sum__num__1 year later",
            ],
        )

        sqls = [
            sql for sql in responses["queries"][0]["query"].split(";") if sql.strip()
        ]
        self.assertEqual(len(sqls), 3)
        # 1 year ago
        assert re.search(r"1989-01-01.+1990-01-01", sqls[1], re.S)
        assert re.search(r"1990-01-01.+1991-01-01", sqls[1], re.S)

        # # 1 year later
        assert re.search(r"1991-01-01.+1992-01-01", sqls[2], re.S)
        assert re.search(r"1990-01-01.+1991-01-01", sqls[2], re.S)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_processing_time_offsets_cache(self):
        """
        Ensure that time_offsets can generate the correct query
        """
        self.login(username="admin")
        payload = get_query_context("birth_names")
        payload["queries"][0]["metrics"] = ["sum__num"]
        # should process empty dateframe correctly
        # due to "name" is random generated, each time_offset slice will be empty
        payload["queries"][0]["groupby"] = ["name"]
        payload["queries"][0]["is_timeseries"] = True
        payload["queries"][0]["timeseries_limit"] = 5
        payload["queries"][0]["time_offsets"] = []
        payload["queries"][0]["time_range"] = "1990 : 1991"
        payload["queries"][0]["granularity"] = "ds"
        payload["queries"][0]["extras"]["time_grain_sqla"] = "P1Y"
        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        query_result = query_context.get_query_result(query_object)
        # get main query dataframe
        df = query_result.df

        payload["queries"][0]["time_offsets"] = ["1 year ago", "1 year later"]
        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        # query without cache
        query_context.processing_time_offsets(df, query_object)
        # query with cache
        rv = query_context.processing_time_offsets(df, query_object)
        cache_keys = rv["cache_keys"]
        cache_keys__1_year_ago = cache_keys[0]
        cache_keys__1_year_later = cache_keys[1]
        self.assertIsNotNone(cache_keys__1_year_ago)
        self.assertIsNotNone(cache_keys__1_year_later)
        self.assertNotEqual(cache_keys__1_year_ago, cache_keys__1_year_later)

        # swap offsets
        payload["queries"][0]["time_offsets"] = ["1 year later", "1 year ago"]
        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        rv = query_context.processing_time_offsets(df, query_object)
        cache_keys = rv["cache_keys"]
        self.assertEqual(cache_keys__1_year_ago, cache_keys[1])
        self.assertEqual(cache_keys__1_year_later, cache_keys[0])

        # remove all offsets
        payload["queries"][0]["time_offsets"] = []
        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        rv = query_context.processing_time_offsets(
            df,
            query_object,
        )
        self.assertIs(rv["df"], df)
        self.assertEqual(rv["queries"], [])
        self.assertEqual(rv["cache_keys"], [])

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_time_offsets_sql(self):
        payload = get_query_context("birth_names")
        payload["queries"][0]["metrics"] = ["sum__num"]
        payload["queries"][0]["groupby"] = ["state"]
        payload["queries"][0]["is_timeseries"] = True
        payload["queries"][0]["timeseries_limit"] = 5
        payload["queries"][0]["time_offsets"] = []
        payload["queries"][0]["time_range"] = "1980 : 1991"
        payload["queries"][0]["granularity"] = "ds"
        payload["queries"][0]["extras"]["time_grain_sqla"] = "P1Y"
        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        query_result = query_context.get_query_result(query_object)
        # get main query dataframe
        df = query_result.df

        # set time_offsets to query_object
        payload["queries"][0]["time_offsets"] = ["3 years ago", "3 years later"]
        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        time_offsets_obj = query_context.processing_time_offsets(df, query_object)
        query_from_1977_to_1988 = time_offsets_obj["queries"][0]
        query_from_1983_to_1994 = time_offsets_obj["queries"][1]

        # should generate expected date range in sql
        assert "1977-01-01" in query_from_1977_to_1988
        assert "1988-01-01" in query_from_1977_to_1988
        assert "1983-01-01" in query_from_1983_to_1994
        assert "1994-01-01" in query_from_1983_to_1994

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_time_offsets_accuracy(self):
        payload = get_query_context("birth_names")
        payload["queries"][0]["metrics"] = ["sum__num"]
        payload["queries"][0]["groupby"] = ["state"]
        payload["queries"][0]["is_timeseries"] = True
        payload["queries"][0]["timeseries_limit"] = 5
        payload["queries"][0]["time_offsets"] = []
        payload["queries"][0]["time_range"] = "1980 : 1991"
        payload["queries"][0]["granularity"] = "ds"
        payload["queries"][0]["extras"]["time_grain_sqla"] = "P1Y"
        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        query_result = query_context.get_query_result(query_object)
        # get main query dataframe
        df = query_result.df

        # set time_offsets to query_object
        payload["queries"][0]["time_offsets"] = ["3 years ago", "3 years later"]
        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        time_offsets_obj = query_context.processing_time_offsets(df, query_object)
        df_with_offsets = time_offsets_obj["df"]
        df_with_offsets = df_with_offsets.set_index(["__timestamp", "state"])

        # should get correct data when apply "3 years ago"
        payload["queries"][0]["time_offsets"] = []
        payload["queries"][0]["time_range"] = "1977 : 1988"
        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        query_result = query_context.get_query_result(query_object)
        # get df for "3 years ago"
        df_3_years_ago = query_result.df
        df_3_years_ago["__timestamp"] = df_3_years_ago["__timestamp"] + DateOffset(
            years=3
        )
        df_3_years_ago = df_3_years_ago.set_index(["__timestamp", "state"])
        for index, row in df_with_offsets.iterrows():
            if index in df_3_years_ago.index:
                assert (
                    row["sum__num__3 years ago"]
                    == df_3_years_ago.loc[index]["sum__num"]
                )

        # should get correct data when apply "3 years later"
        payload["queries"][0]["time_offsets"] = []
        payload["queries"][0]["time_range"] = "1983 : 1994"
        query_context = ChartDataQueryContextSchema().load(payload)
        query_object = query_context.queries[0]
        query_result = query_context.get_query_result(query_object)
        # get df for "3 years later"
        df_3_years_later = query_result.df
        df_3_years_later["__timestamp"] = df_3_years_later["__timestamp"] - DateOffset(
            years=3
        )
        df_3_years_later = df_3_years_later.set_index(["__timestamp", "state"])
        for index, row in df_with_offsets.iterrows():
            if index in df_3_years_later.index:
                assert (
                    row["sum__num__3 years later"]
                    == df_3_years_later.loc[index]["sum__num"]
                )


def test_get_label_map(app_context, virtual_dataset_comma_in_column_value):
    qc = QueryContextFactory().create(
        datasource={
            "type": virtual_dataset_comma_in_column_value.type,
            "id": virtual_dataset_comma_in_column_value.id,
        },
        queries=[
            {
                "columns": ["col1", "col2"],
                "metrics": ["count"],
                "post_processing": [
                    {
                        "operation": "pivot",
                        "options": {
                            "aggregates": {"count": {"operator": "mean"}},
                            "columns": ["col2"],
                            "index": ["col1"],
                        },
                    },
                    {"operation": "flatten"},
                ],
            }
        ],
        result_type=ChartDataResultType.FULL,
        force=True,
    )
    query_object = qc.queries[0]
    df = qc.get_df_payload(query_object)["df"]
    label_map = qc.get_df_payload(query_object)["label_map"]
    assert list(df.columns.values) == [
        "col1",
        "count" + FLAT_COLUMN_SEPARATOR + "col2, row1",
        "count" + FLAT_COLUMN_SEPARATOR + "col2, row2",
        "count" + FLAT_COLUMN_SEPARATOR + "col2, row3",
    ]
    assert label_map == {
        "col1": ["col1"],
        "count, col2, row1": ["count", "col2, row1"],
        "count, col2, row2": ["count", "col2, row2"],
        "count, col2, row3": ["count", "col2, row3"],
    }


def test_time_column_with_time_grain(app_context, physical_dataset):
    column_on_axis: AdhocColumn = {
        "label": "I_AM_AN_ORIGINAL_COLUMN",
        "sqlExpression": "col5",
        "timeGrain": "P1Y",
    }
    adhoc_column: AdhocColumn = {
        "label": "I_AM_A_TRUNC_COLUMN",
        "sqlExpression": "col6",
        "columnType": "BASE_AXIS",
        "timeGrain": "P1Y",
    }
    qc = QueryContextFactory().create(
        datasource={
            "type": physical_dataset.type,
            "id": physical_dataset.id,
        },
        queries=[
            {
                "columns": ["col1", column_on_axis, adhoc_column],
                "metrics": ["count"],
                "orderby": [["col1", True]],
            }
        ],
        result_type=ChartDataResultType.FULL,
        force=True,
    )
    query_object = qc.queries[0]
    df = qc.get_df_payload(query_object)["df"]
    if query_object.datasource.database.backend == "sqlite":
        # sqlite returns string as timestamp column
        assert df["I_AM_AN_ORIGINAL_COLUMN"][0] == "2000-01-01 00:00:00"
        assert df["I_AM_AN_ORIGINAL_COLUMN"][1] == "2000-01-02 00:00:00"
        assert df["I_AM_A_TRUNC_COLUMN"][0] == "2002-01-01 00:00:00"
        assert df["I_AM_A_TRUNC_COLUMN"][1] == "2002-01-01 00:00:00"
    else:
        assert df["I_AM_AN_ORIGINAL_COLUMN"][0].strftime("%Y-%m-%d") == "2000-01-01"
        assert df["I_AM_AN_ORIGINAL_COLUMN"][1].strftime("%Y-%m-%d") == "2000-01-02"
        assert df["I_AM_A_TRUNC_COLUMN"][0].strftime("%Y-%m-%d") == "2002-01-01"
        assert df["I_AM_A_TRUNC_COLUMN"][1].strftime("%Y-%m-%d") == "2002-01-01"


def test_non_time_column_with_time_grain(app_context, physical_dataset):
    qc = QueryContextFactory().create(
        datasource={
            "type": physical_dataset.type,
            "id": physical_dataset.id,
        },
        queries=[
            {
                "columns": [
                    "col1",
                    {
                        "label": "COL2 ALIAS",
                        "sqlExpression": "col2",
                        "columnType": "BASE_AXIS",
                        "timeGrain": "P1Y",
                    },
                ],
                "metrics": ["count"],
                "orderby": [["col1", True]],
                "row_limit": 1,
            }
        ],
        result_type=ChartDataResultType.FULL,
        force=True,
    )

    query_object = qc.queries[0]
    df = qc.get_df_payload(query_object)["df"]
    assert df["COL2 ALIAS"][0] == "a"


def test_special_chars_in_column_name(app_context, physical_dataset):
    qc = QueryContextFactory().create(
        datasource={
            "type": physical_dataset.type,
            "id": physical_dataset.id,
        },
        queries=[
            {
                "columns": [
                    "col1",
                    "time column with spaces",
                    {
                        "label": "I_AM_A_TRUNC_COLUMN",
                        "sqlExpression": "time column with spaces",
                        "columnType": "BASE_AXIS",
                        "timeGrain": "P1Y",
                    },
                ],
                "metrics": ["count"],
                "orderby": [["col1", True]],
                "row_limit": 1,
            }
        ],
        result_type=ChartDataResultType.FULL,
        force=True,
    )

    query_object = qc.queries[0]
    df = qc.get_df_payload(query_object)["df"]
    if query_object.datasource.database.backend == "sqlite":
        # sqlite returns string as timestamp column
        assert df["time column with spaces"][0] == "2002-01-03 00:00:00"
        assert df["I_AM_A_TRUNC_COLUMN"][0] == "2002-01-01 00:00:00"
    else:
        assert df["time column with spaces"][0].strftime("%Y-%m-%d") == "2002-01-03"
        assert df["I_AM_A_TRUNC_COLUMN"][0].strftime("%Y-%m-%d") == "2002-01-01"


@only_postgresql
def test_date_adhoc_column(app_context, physical_dataset):
    # sql expression returns date type
    column_on_axis: AdhocColumn = {
        "label": "ADHOC COLUMN",
        "sqlExpression": "col6 + interval '20 year'",
        "columnType": "BASE_AXIS",
        "timeGrain": "P1Y",
    }
    qc = QueryContextFactory().create(
        datasource={
            "type": physical_dataset.type,
            "id": physical_dataset.id,
        },
        queries=[
            {
                "columns": [column_on_axis],
                "metrics": ["count"],
            }
        ],
        result_type=ChartDataResultType.FULL,
        force=True,
    )
    query_object = qc.queries[0]
    df = qc.get_df_payload(query_object)["df"]
    #   ADHOC COLUMN  count
    # 0   2022-01-01     10
    assert df["ADHOC COLUMN"][0].strftime("%Y-%m-%d") == "2022-01-01"
    assert df["count"][0] == 10


@only_postgresql
def test_non_date_adhoc_column(app_context, physical_dataset):
    # sql expression returns non-date type
    column_on_axis: AdhocColumn = {
        "label": "ADHOC COLUMN",
        "sqlExpression": "col1 * 10",
        "columnType": "BASE_AXIS",
        "timeGrain": "P1Y",
    }
    qc = QueryContextFactory().create(
        datasource={
            "type": physical_dataset.type,
            "id": physical_dataset.id,
        },
        queries=[
            {
                "columns": [column_on_axis],
                "metrics": ["count"],
                "orderby": [
                    [
                        {
                            "expressionType": "SQL",
                            "sqlExpression": '"ADHOC COLUMN"',
                        },
                        True,
                    ]
                ],
            }
        ],
        result_type=ChartDataResultType.FULL,
        force=True,
    )
    query_object = qc.queries[0]
    df = qc.get_df_payload(query_object)["df"]
    assert df["ADHOC COLUMN"][0] == 0
    assert df["ADHOC COLUMN"][1] == 10


@only_sqlite
def test_time_grain_and_time_offset_with_base_axis(app_context, physical_dataset):
    column_on_axis: AdhocColumn = {
        "label": "col6",
        "sqlExpression": "col6",
        "columnType": "BASE_AXIS",
        "timeGrain": "P3M",
    }
    qc = QueryContextFactory().create(
        datasource={
            "type": physical_dataset.type,
            "id": physical_dataset.id,
        },
        queries=[
            {
                "columns": [column_on_axis],
                "metrics": [
                    {
                        "label": "SUM(col1)",
                        "expressionType": "SQL",
                        "sqlExpression": "SUM(col1)",
                    }
                ],
                "time_offsets": ["3 month ago"],
                "granularity": "col6",
                "time_range": "2002-01 : 2003-01",
            }
        ],
        result_type=ChartDataResultType.FULL,
        force=True,
    )
    query_object = qc.queries[0]
    df = qc.get_df_payload(query_object)["df"]
    # todo: MySQL returns integer and float column as object type
    """
        col6  SUM(col1)  SUM(col1)__3 month ago
0 2002-01-01          3                     NaN
1 2002-04-01         12                     3.0
2 2002-07-01         21                    12.0
3 2002-10-01          9                    21.0
    """
    assert df.equals(
        pd.DataFrame(
            data={
                "col6": pd.to_datetime(
                    ["2002-01-01", "2002-04-01", "2002-07-01", "2002-10-01"]
                ),
                "SUM(col1)": [3, 12, 21, 9],
                "SUM(col1)__3 month ago": [np.nan, 3, 12, 21],
            }
        )
    )


@only_sqlite
def test_time_grain_and_time_offset_on_legacy_query(app_context, physical_dataset):
    qc = QueryContextFactory().create(
        datasource={
            "type": physical_dataset.type,
            "id": physical_dataset.id,
        },
        queries=[
            {
                "columns": [],
                "extras": {
                    "time_grain_sqla": "P3M",
                },
                "metrics": [
                    {
                        "label": "SUM(col1)",
                        "expressionType": "SQL",
                        "sqlExpression": "SUM(col1)",
                    }
                ],
                "time_offsets": ["3 month ago"],
                "granularity": "col6",
                "time_range": "2002-01 : 2003-01",
                "is_timeseries": True,
            }
        ],
        result_type=ChartDataResultType.FULL,
        force=True,
    )
    query_object = qc.queries[0]
    df = qc.get_df_payload(query_object)["df"]
    # todo: MySQL returns integer and float column as object type
    """
  __timestamp  SUM(col1)  SUM(col1)__3 month ago
0  2002-01-01          3                     NaN
1  2002-04-01         12                     3.0
2  2002-07-01         21                    12.0
3  2002-10-01          9                    21.0
    """
    assert df.equals(
        pd.DataFrame(
            data={
                "__timestamp": pd.to_datetime(
                    ["2002-01-01", "2002-04-01", "2002-07-01", "2002-10-01"]
                ),
                "SUM(col1)": [3, 12, 21, 9],
                "SUM(col1)__3 month ago": [np.nan, 3, 12, 21],
            }
        )
    )
