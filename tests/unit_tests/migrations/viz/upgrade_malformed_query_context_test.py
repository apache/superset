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
from superset.migrations.shared.migrate_viz import MigrateLineChart
from superset.migrations.shared.migrate_viz.base import FULL_CONTEXT_BAK_KEY
from superset.models.slice import Slice
from superset.utils import json


def test_upgrade_slice_survives_a_query_context_without_queries() -> None:
    """A stored query_context is expected to carry "queries", but
    upgrade_slice must not leave a slice half-migrated (new viz_type, stale
    params/query_context) if an atypical one doesn't -- it used to raise a
    bare KeyError there, caught by the broad except, after viz_type had
    already been flipped."""
    source = {"viz_type": "line", "datasource": "1__table", "x_axis_label": "x"}
    original_query_context = {"form_data": source}

    slc = Slice(
        viz_type="line",
        datasource_type="table",
        params=json.dumps(source),
        # No "queries" key, unlike a normal query_context.
        query_context=json.dumps(original_query_context),
    )

    MigrateLineChart.upgrade_slice(slc)

    assert slc.viz_type == "echarts_timeseries_line"
    upgraded_params = json.loads(slc.params)
    assert upgraded_params["form_data_bak"] == source
    # The original context (minus "queries") is backed up wholesale, rather
    # than being lost, so downgrade can restore it verbatim.
    assert upgraded_params.get("queries_bak") == {
        FULL_CONTEXT_BAK_KEY: original_query_context
    }
    assert json.loads(slc.query_context)["form_data"]["viz_type"] == (
        "echarts_timeseries_line"
    )

    MigrateLineChart.downgrade_slice(slc)

    assert slc.viz_type == "line"
    assert json.loads(slc.params) == source
    assert json.loads(slc.query_context) == original_query_context


def test_downgrade_slice_restores_an_original_null_queries() -> None:
    """An original query_context with "queries": null backs up as a bare
    `None`, indistinguishable from "no context was ever stored" -- it must
    be routed through the same FULL_CONTEXT_BAK_KEY wholesale backup as a
    missing "queries" key so downgrade_slice can tell the two apart and
    restore the slice's original datasource/form_data instead of discarding
    them."""
    source = {"viz_type": "line", "datasource": "1__table", "x_axis_label": "x"}
    original_query_context = {"datasource": "1__table", "queries": None}

    slc = Slice(
        viz_type="line",
        datasource_type="table",
        params=json.dumps(source),
        query_context=json.dumps(original_query_context),
    )

    MigrateLineChart.upgrade_slice(slc)
    upgraded_params = json.loads(slc.params)
    assert upgraded_params.get("queries_bak") == {
        FULL_CONTEXT_BAK_KEY: original_query_context
    }

    MigrateLineChart.downgrade_slice(slc)

    assert slc.viz_type == "line"
    assert json.loads(slc.params) == source
    assert json.loads(slc.query_context) == original_query_context


def test_upgrade_slice_survives_a_non_object_query_context() -> None:
    """A parseable but non-object query_context (e.g. a bare number or a
    JSON list, both accepted by the schema validator) must not raise when
    membership-tested for "queries" -- that would leave the slice
    half-migrated (new viz_type already set, but stale params/query_context
    in the old shape) since the exception is swallowed by the broad
    top-level catch."""
    source = {"viz_type": "line", "datasource": "1__table", "x_axis_label": "x"}

    slc = Slice(
        viz_type="line",
        datasource_type="table",
        params=json.dumps(source),
        query_context=json.dumps(1),
    )

    MigrateLineChart.upgrade_slice(slc)

    assert slc.viz_type == "echarts_timeseries_line"
    upgraded_params = json.loads(slc.params)
    assert upgraded_params.get("queries_bak") == {FULL_CONTEXT_BAK_KEY: 1}
    # A fresh query_context was rebuilt rather than left in the old shape.
    assert json.loads(slc.query_context)["form_data"]["viz_type"] == (
        "echarts_timeseries_line"
    )

    MigrateLineChart.downgrade_slice(slc)

    assert slc.viz_type == "line"
    assert json.loads(slc.params) == source
    assert json.loads(slc.query_context) == 1


def test_downgrade_slice_restores_an_original_empty_queries_list() -> None:
    """An original query_context with "queries": [] backs up as a falsy-but-
    present list, not None -- downgrade_slice must not mistake that for "no
    context was ever stored" and discard the slice's datasource/form_data by
    setting query_context to None."""
    source = {"viz_type": "line", "datasource": "1__table", "x_axis_label": "x"}
    original_query_context = {"datasource": "1__table", "queries": []}

    slc = Slice(
        viz_type="line",
        datasource_type="table",
        params=json.dumps(source),
        query_context=json.dumps(original_query_context),
    )

    MigrateLineChart.upgrade_slice(slc)
    upgraded_params = json.loads(slc.params)
    assert upgraded_params.get("queries_bak") == []

    MigrateLineChart.downgrade_slice(slc)

    assert slc.viz_type == "line"
    assert json.loads(slc.params) == source
    assert json.loads(slc.query_context) == original_query_context
