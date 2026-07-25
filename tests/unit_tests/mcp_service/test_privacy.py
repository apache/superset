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

"""Tests for MCP privacy helpers."""

from unittest.mock import patch

import pytest

from superset.mcp_service.chart.schemas import ChartInfo
from superset.mcp_service.dashboard.schemas import DashboardInfo
from superset.mcp_service.database.schemas import DatabaseInfo
from superset.mcp_service.dataset.schemas import DatasetInfo
from superset.mcp_service.privacy import (
    is_data_model_metadata_error,
    redact_chart_data_model_fields,
    user_can_view_data_model_metadata,
)
from superset.mcp_service.report.schemas import ReportInfo


def test_user_can_view_data_model_metadata_denies_guest() -> None:
    """A guest is denied even when the (Gamma-like) role would pass can_access.

    A PUBLIC_ROLE_LIKE=Gamma guest carries can_get_drill_info on Dataset, so the
    permission check alone returns True; the guest short-circuit must override it.
    """
    from superset.extensions import security_manager

    with (
        patch.object(security_manager, "is_guest_user", return_value=True),
        patch.object(security_manager, "can_access", return_value=True) as can_access,
    ):
        assert user_can_view_data_model_metadata() is False
        can_access.assert_not_called()


def test_user_can_view_data_model_metadata_allows_privileged_non_guest() -> None:
    """A non-guest with a metadata permission still passes."""
    from superset.extensions import security_manager

    with (
        patch.object(security_manager, "is_guest_user", return_value=False),
        patch.object(
            security_manager,
            "can_access",
            side_effect=lambda perm, _: perm == "can_write",
        ),
    ):
        assert user_can_view_data_model_metadata() is True


def test_user_can_view_data_model_metadata_denies_unprivileged_non_guest() -> None:
    """A non-guest without drill/create/write on Dataset is denied."""
    from superset.extensions import security_manager

    with (
        patch.object(security_manager, "is_guest_user", return_value=False),
        patch.object(security_manager, "can_access", return_value=False),
    ):
        assert user_can_view_data_model_metadata() is False


def test_is_data_model_metadata_error_accepts_missing_privacy_scope() -> None:
    assert (
        is_data_model_metadata_error(
            {
                "error": "denied",
                "error_type": "DataModelMetadataRestricted",
                "timestamp": "2026-04-23T11:20:54.286885",
            }
        )
        is True
    )


def test_is_data_model_metadata_error_rejects_wrong_privacy_scope() -> None:
    assert (
        is_data_model_metadata_error(
            {
                "error": "denied",
                "error_type": "DataModelMetadataRestricted",
                "privacy_scope": "user_directory",
            }
        )
        is False
    )


def test_redact_chart_data_model_fields_removes_restricted_fields() -> None:
    chart_info = ChartInfo(
        id=1,
        slice_name="Revenue",
        datasource_name="sales",
        datasource_type="table",
        filters={"time_range": "Last year"},
        form_data={"datasource": "1__table"},
    )

    redacted = redact_chart_data_model_fields(chart_info)

    assert redacted.datasource_name is None
    assert redacted.datasource_type is None
    assert redacted.filters is None
    assert redacted.form_data is None


@pytest.mark.parametrize(
    "model",
    [
        ChartInfo(id=1, slice_name="Revenue"),
        DashboardInfo(id=1, dashboard_title="Executive Dashboard", editors=[]),
        DatasetInfo(id=1, table_name="sales"),
        ReportInfo(id=1, name="Daily Report", editors=[]),
        DatabaseInfo(id=1, database_name="warehouse"),
    ],
)
def test_user_directory_fields_removed_from_python_and_json_dumps(model):
    """Privacy fields are stripped regardless of Pydantic serialization mode."""
    for mode in (None, "json"):
        data = model.model_dump() if mode is None else model.model_dump(mode=mode)

        for field in ("created_by", "changed_by", "editors", "roles"):
            assert field not in data


@pytest.mark.parametrize(
    ("schema_cls", "omitted_fields"),
    [
        (ChartInfo, {"created_by", "changed_by", "changed_by_name", "editors"}),
        (DashboardInfo, {"created_by", "changed_by", "editors"}),
        (DatasetInfo, {"created_by", "changed_by", "editors"}),
        (ReportInfo, {"created_by", "changed_by", "editors"}),
        (DatabaseInfo, {"created_by", "changed_by"}),
    ],
)
def test_user_directory_fields_removed_from_json_schema(schema_cls, omitted_fields):
    """Privacy-only response fields should not appear in the published schema."""
    properties = schema_cls.model_json_schema().get("properties", {})

    for field in omitted_fields:
        assert field not in properties
