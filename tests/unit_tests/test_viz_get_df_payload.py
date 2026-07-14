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
from typing import Any
from unittest.mock import patch

import pytest
from flask import current_app

from superset import viz
from superset.common.db_query_status import QueryStatus
from superset.connectors.sqla.models import SqlaTable
from superset.errors import SupersetErrorType
from superset.exceptions import (
    OAuth2RedirectError,
    QueryObjectValidationError,
)
from superset.models.core import Database

QUERY_OBJ: dict[str, Any] = {"row_limit": 100, "from_dttm": None, "to_dttm": None}


def _viz() -> viz.BaseViz:
    database = Database(database_name="d", sqlalchemy_uri="sqlite://")
    datasource = SqlaTable(
        table_name="t",
        columns=[],
        metrics=[],
        main_dttm_col=None,
        database=database,
    )
    # ``force=True`` skips the data cache lookup branch so ``get_df`` is always
    # invoked, which is what we want to assert error-handling against.
    return viz.BaseViz(
        datasource=datasource,
        form_data={"viz_type": "table"},
        force=True,
    )


def _timeseries_viz(form_data: dict[str, Any]) -> viz.NVD3TimeSeriesViz:
    database = Database(database_name="d", sqlalchemy_uri="sqlite://")
    datasource = SqlaTable(
        table_name="t",
        columns=[],
        metrics=[],
        main_dttm_col=None,
        database=database,
    )
    base_form_data: dict[str, Any] = {"viz_type": "line", "metrics": ["value"]}
    base_form_data.update(form_data)
    return viz.NVD3TimeSeriesViz(
        datasource=datasource,
        form_data=base_form_data,
        force=True,
    )


def _resample_df() -> Any:
    import pandas as pd

    from superset.utils.core import DTTM_ALIAS

    return pd.DataFrame(
        {
            DTTM_ALIAS: pd.to_datetime(["2024-01-01", "2024-01-02", "2024-01-03"]),
            "value": [1, 2, 3],
        }
    )


def test_process_data_rejects_unknown_resample_method() -> None:
    """
    A resample method outside the allowlist must raise
    ``QueryObjectValidationError`` before any dynamic dispatch happens.
    """
    obj = _timeseries_viz({"resample_rule": "1D", "resample_method": "__class__"})

    with pytest.raises(QueryObjectValidationError):
        obj.process_data(_resample_df())


def test_process_data_accepts_allowlisted_resample_method() -> None:
    """
    A valid resample method (e.g. ``mean``) is applied successfully.
    """
    obj = _timeseries_viz({"resample_rule": "1D", "resample_method": "mean"})

    result = obj.process_data(_resample_df())

    assert result is not None
    assert not result.empty


def test_run_extra_queries_rejects_excessive_time_compare() -> None:
    """
    Requesting more time-shift comparisons than ``VIZ_TIME_COMPARE_MAX`` must
    raise ``QueryObjectValidationError`` before any sub-queries are issued.
    """
    max_compare = current_app.config["VIZ_TIME_COMPARE_MAX"]
    obj = _timeseries_viz(
        {"time_compare": [f"{i} days ago" for i in range(1, max_compare + 2)]}
    )

    with pytest.raises(QueryObjectValidationError):
        obj.run_extra_queries()


def test_deck_multi_rejects_excessive_sub_slices() -> None:
    """
    Requesting more deck.gl sub-slices than ``DECK_MULTI_MAX_SLICES`` must raise
    ``QueryObjectValidationError`` before any sub-query is issued.
    """
    database = Database(database_name="d", sqlalchemy_uri="sqlite://")
    datasource = SqlaTable(
        table_name="t",
        columns=[],
        metrics=[],
        main_dttm_col=None,
        database=database,
    )
    max_slices = current_app.config["DECK_MULTI_MAX_SLICES"]
    obj = viz.DeckGLMultiLayer(
        datasource=datasource,
        form_data={
            "viz_type": "deck_multi",
            "deck_slices": list(range(max_slices + 1)),
        },
        force=True,
    )

    with pytest.raises(QueryObjectValidationError):
        obj.get_data(_resample_df())


def test_get_df_payload_propagates_oauth2_redirect_error() -> None:
    """
    OAuth2RedirectError (a SupersetErrorException) must propagate out of
    ``get_df_payload`` so the global Flask error handler can serialize it.
    """
    obj = _viz()
    oauth_exc = OAuth2RedirectError(
        url="https://accounts.example.com/o/oauth2/v2/auth?...",
        tab_id="tab-123",
        redirect_uri="https://superset.example.com/oauth2/redirect",
    )

    with patch.object(viz.BaseViz, "get_df", side_effect=oauth_exc):
        with pytest.raises(OAuth2RedirectError) as exc_info:
            obj.get_df_payload(QUERY_OBJ)

    assert exc_info.value.error.error_type == SupersetErrorType.OAUTH2_REDIRECT
    assert exc_info.value.error.extra == {
        "url": "https://accounts.example.com/o/oauth2/v2/auth?...",
        "tab_id": "tab-123",
        "redirect_uri": "https://superset.example.com/oauth2/redirect",
    }


def test_get_df_payload_captures_generic_exception_as_viz_get_df_error() -> None:
    """
    Non-Superset exception raised by ``get_df`` are downgraded to a
    ``VIZ_GET_DF_ERROR`` entry on ``self.errors``.
    """
    obj = _viz()

    with patch.object(viz.BaseViz, "get_df", side_effect=RuntimeError("boom")):
        payload = obj.get_df_payload(QUERY_OBJ)

    assert obj.status == QueryStatus.FAILED
    assert payload["status"] == QueryStatus.FAILED
    assert len(obj.errors) == 1
    assert obj.errors[0]["error_type"] == SupersetErrorType.VIZ_GET_DF_ERROR
    assert obj.errors[0]["message"] == "boom"


def test_get_df_payload_captures_query_object_validation_error() -> None:
    """
    ``QueryObjectValidationError`` is reported as ``VIZ_GET_DF_ERROR``.
    """
    obj = _viz()

    with patch.object(
        viz.BaseViz,
        "get_df",
        side_effect=QueryObjectValidationError("bad query"),
    ):
        payload = obj.get_df_payload(QUERY_OBJ)

    assert obj.status == QueryStatus.FAILED
    assert payload["status"] == QueryStatus.FAILED
    assert len(obj.errors) == 1
    assert obj.errors[0]["error_type"] == SupersetErrorType.VIZ_GET_DF_ERROR
    assert obj.errors[0]["message"] == "bad query"


def test_get_df_payload_hides_stacktrace_when_show_stacktrace_disabled() -> None:
    """
    The error payload must not expose a stacktrace when neither ``debug`` nor
    ``SHOW_STACKTRACE`` is enabled.
    """
    obj = _viz()

    # The test app runs with ``debug`` disabled, so toggling ``SHOW_STACKTRACE``
    # off is enough to exercise the hidden-stacktrace branch.
    assert current_app.debug is False
    with (
        patch.object(viz.BaseViz, "get_df", side_effect=RuntimeError("boom")),
        patch.dict(current_app.config, {"SHOW_STACKTRACE": False}),
    ):
        payload = obj.get_df_payload(QUERY_OBJ)

    assert obj.status == QueryStatus.FAILED
    assert payload["stacktrace"] is None


def test_get_df_payload_shows_stacktrace_when_show_stacktrace_enabled() -> None:
    """
    The error payload must expose a stacktrace when ``SHOW_STACKTRACE`` is enabled.
    """
    obj = _viz()

    with (
        patch.object(viz.BaseViz, "get_df", side_effect=RuntimeError("boom")),
        patch.dict(current_app.config, {"SHOW_STACKTRACE": True}),
    ):
        payload = obj.get_df_payload(QUERY_OBJ)

    assert obj.status == QueryStatus.FAILED
    assert payload["stacktrace"] is not None
    assert "RuntimeError" in payload["stacktrace"]
