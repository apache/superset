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
"""Chart-data results must not round integers beyond 2**53 - 1."""

from datetime import timedelta
from unittest.mock import MagicMock

import pandas as pd

from superset.dataframe import df_to_records
from superset.models.helpers import ExploreMixin, QueryResult
from superset.utils import json

LARGE_INTEGER = 333466480986292423


def _run_plain_query_and_serialize(df: pd.DataFrame) -> str:
    """Run ``ExploreMixin.get_query_result`` and the chart-data JSON encoding."""
    datasource = MagicMock()
    datasource.offset = 0
    datasource.enforce_numerical_metrics = True
    datasource.columns = []
    datasource.get_column = lambda name: None
    datasource.query = lambda query_obj: QueryResult(
        df=df, query="", duration=timedelta(0)
    )
    for method in (
        "_python_date_format",
        "_collect_dttm_labels",
        "_offset_only_dttm_cols",
        "normalize_df",
        "get_query_result",
    ):
        setattr(datasource, method, getattr(ExploreMixin, method).__get__(datasource))

    # a plain query: one selected column, no metrics, no Python-side processing
    query_object = MagicMock()
    query_object.columns = ["value"]
    query_object.column_names = ["value"]
    query_object.metrics = []
    query_object.metric_names = []
    query_object.granularity = None
    query_object.time_shift = None
    query_object.post_processing = []
    query_object.time_offsets = []
    query_object.exec_post_processing = lambda frame: frame

    result = datasource.get_query_result(query_object)
    return json.dumps(
        df_to_records(result.df),
        default=json.json_int_dttm_ser,
        ignore_nan=True,
    )


def test_nullable_bigint_column_keeps_every_digit() -> None:
    # a nullable BIGINT column arrives as an object column of ints and None
    df = pd.DataFrame({"value": pd.Series([LARGE_INTEGER, None], dtype=object)})

    payload = _run_plain_query_and_serialize(df)

    assert str(LARGE_INTEGER) in payload
