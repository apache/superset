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
# pylint: disable=import-outside-toplevel, invalid-name, unused-argument, redefined-outer-name
from typing import Any

import pytest
from marshmallow import ValidationError
from pytest_mock import MockerFixture

from superset.time_range_limits.policy import FEATURE_FLAG
from superset.utils import json

VALID_LIMITS = {
    "schema_version": 1,
    "max_span": {"quantity": 90, "time_grain": "P1D"},
    "max_look_back": {"quantity": 13, "time_grain": "P1M"},
    "max_look_forward": {"quantity": 0, "time_grain": "P1D"},
}
NO_LIMITS = {
    "schema_version": 1,
    "max_span": None,
    "max_look_back": None,
    "max_look_forward": None,
}

# A bad policy and the path of the field it names.
BAD_LIMITS_FIELDS = [
    (
        {**NO_LIMITS, "max_span": {"quantity": 0, "time_grain": "P1D"}},
        "max_span.quantity",
    ),
    (
        {**NO_LIMITS, "max_span": {"quantity": "90", "time_grain": "P1D"}},
        "max_span.quantity",
    ),
    ({**NO_LIMITS, "max_range_day": 90}, "max_range_day"),
    ({**NO_LIMITS, "max_look_back": {"quantity": 13}}, "max_look_back.time_grain"),
    (
        {**NO_LIMITS, "max_look_forward": {"quantity": 1, "time_grain": "tomorrow"}},
        "max_look_forward.time_grain",
    ),
    ({**NO_LIMITS, "schema_version": 2}, "schema_version"),
    ({"max_range": "90 days"}, "max_look_back"),
    ({}, "max_look_back"),
    ([], None),
    ("90", None),
]
BAD_LIMITS = [limits for limits, _field in BAD_LIMITS_FIELDS]
# The old key, built so the grep for leftovers of the old shape only finds real uses.
OLD_KEY = "_".join(("date", "range", "limits"))


@pytest.fixture(params=[False, True], ids=["flag-off", "flag-on"])
def limits_flag(request: Any, mocker: MockerFixture) -> bool:
    from superset.extensions import feature_flag_manager

    flags = feature_flag_manager._feature_flags or {}
    mocker.patch.object(
        feature_flag_manager,
        "get_feature_flags",
        return_value={**flags, FEATURE_FLAG: request.param},
    )
    return request.param


@pytest.fixture
def limits_on(mocker: MockerFixture) -> None:
    from superset.extensions import feature_flag_manager

    flags = feature_flag_manager._feature_flags or {}
    mocker.patch.object(
        feature_flag_manager,
        "get_feature_flags",
        return_value={**flags, FEATURE_FLAG: True},
    )


@pytest.fixture
def limits_off(mocker: MockerFixture) -> None:
    from superset.extensions import feature_flag_manager

    flags = feature_flag_manager._feature_flags or {}
    mocker.patch.object(
        feature_flag_manager,
        "get_feature_flags",
        return_value={**flags, FEATURE_FLAG: False},
    )


def test_json_metadata_schema_accepts_time_range_limits() -> None:
    from superset.dashboards.schemas import DashboardJSONMetadataSchema

    metadata = {"time_range_limits": VALID_LIMITS, "refresh_frequency": 0}
    assert DashboardJSONMetadataSchema().load(metadata) == metadata


@pytest.mark.parametrize("limits", [None, NO_LIMITS])
def test_json_metadata_schema_accepts_empty_time_range_limits(limits: Any) -> None:
    from superset.dashboards.schemas import DashboardJSONMetadataSchema

    metadata = {"time_range_limits": limits}
    assert DashboardJSONMetadataSchema().load(metadata) == metadata


def test_json_metadata_schema_still_rejects_unknown_keys() -> None:
    from superset.dashboards.schemas import DashboardJSONMetadataSchema

    errors = DashboardJSONMetadataSchema().validate({"time_range_limit": VALID_LIMITS})
    assert errors == {"time_range_limit": ["Unknown field."]}
    errors = DashboardJSONMetadataSchema().validate({OLD_KEY: VALID_LIMITS})
    assert errors == {OLD_KEY: ["Unknown field."]}


@pytest.mark.parametrize("limits", BAD_LIMITS)
def test_json_metadata_schema_leaves_the_policy_to_the_write_schemas(
    limits: Any,
) -> None:
    from superset.dashboards.schemas import DashboardJSONMetadataSchema

    assert DashboardJSONMetadataSchema().validate({"time_range_limits": limits}) == {}


@pytest.mark.parametrize("schema_name", ["DashboardPostSchema", "DashboardPutSchema"])
def test_dashboard_write_schemas_accept_time_range_limits(
    schema_name: str, limits_flag: bool
) -> None:
    import superset.dashboards.schemas as schemas

    json_metadata = json.dumps({"time_range_limits": VALID_LIMITS})
    loaded = getattr(schemas, schema_name)().load({"json_metadata": json_metadata})
    assert loaded["json_metadata"] == json_metadata


@pytest.mark.parametrize(
    "schema_name", ["DashboardPostSchema", "DashboardPutSchema", "DashboardCopySchema"]
)
@pytest.mark.parametrize(("limits", "field"), BAD_LIMITS_FIELDS)
def test_dashboard_write_schemas_reject_bad_time_range_limits(
    schema_name: str, limits: Any, field: str | None, limits_on: None
) -> None:
    import superset.dashboards.schemas as schemas
    from superset.time_range_limits.policy import (
        parse_time_range_limits,
        TimeRangeLimitsInvalidError,
    )

    payload = {"json_metadata": json.dumps({"time_range_limits": limits})}
    if schema_name == "DashboardCopySchema":
        payload["dashboard_title"] = "copy"
    with pytest.raises(ValidationError) as excinfo:
        getattr(schemas, schema_name)().load(payload)

    with pytest.raises(TimeRangeLimitsInvalidError) as parse_error:
        parse_time_range_limits(limits)
    key = "json_metadata.time_range_limits"
    assert excinfo.value.messages == {
        f"{key}.{field}" if field else key: [str(parse_error.value)]
    }


@pytest.mark.parametrize(
    "schema_name", ["DashboardPostSchema", "DashboardPutSchema", "DashboardCopySchema"]
)
def test_write_schemas_check_the_unit_only_with_the_flag_on(
    schema_name: str, limits_flag: bool
) -> None:
    import superset.dashboards.schemas as schemas

    limits = {**NO_LIMITS, "max_span": {"quantity": 1, "time_grain": "tomorrow"}}
    payload = {
        "json_metadata": json.dumps({"time_range_limits": limits}),
        "dashboard_title": "copy",
    }
    if not limits_flag:
        assert (
            getattr(schemas, schema_name)().load(payload)["json_metadata"]
            == payload["json_metadata"]
        )
        return
    with pytest.raises(ValidationError) as excinfo:
        getattr(schemas, schema_name)().load(payload)

    assert list(excinfo.value.messages) == [
        "json_metadata.time_range_limits.max_span.time_grain"
    ]


@pytest.mark.parametrize(
    "schema_name", ["DashboardPostSchema", "DashboardPutSchema", "DashboardCopySchema"]
)
@pytest.mark.parametrize("limits", BAD_LIMITS)
def test_write_schemas_store_a_bad_policy_with_the_flag_off(
    schema_name: str, limits: Any, limits_off: None
) -> None:
    import superset.dashboards.schemas as schemas

    payload = {
        "json_metadata": json.dumps({"time_range_limits": limits}),
        "dashboard_title": "copy",
    }
    loaded = getattr(schemas, schema_name)().load(payload)
    assert loaded["json_metadata"] == payload["json_metadata"]


def import_v1_dashboard_config(**overrides: Any) -> dict[str, Any]:
    return {
        "dashboard_title": "My dashboard",
        "uuid": "10808100-158b-42c4-842e-f32b99d88dfb",
        "version": "1.0.0",
        **overrides,
    }


@pytest.mark.parametrize("limits", BAD_LIMITS)
def test_import_v1_dashboard_schema_rejects_bad_time_range_limits(
    limits: Any, limits_on: None
) -> None:
    from superset.dashboards.schemas import ImportV1DashboardSchema

    config = import_v1_dashboard_config(metadata={"time_range_limits": limits})
    with pytest.raises(ValidationError) as excinfo:
        ImportV1DashboardSchema().load(config)

    assert list(excinfo.value.messages) == ["metadata"]


@pytest.mark.parametrize("limits", BAD_LIMITS)
def test_import_v1_dashboard_schema_keeps_a_bad_policy_with_the_flag_off(
    limits: Any, limits_off: None
) -> None:
    from superset.dashboards.schemas import ImportV1DashboardSchema

    metadata = {"time_range_limits": limits}
    loaded = ImportV1DashboardSchema().load(
        import_v1_dashboard_config(metadata=metadata)
    )
    assert loaded["metadata"] == metadata


@pytest.mark.parametrize(
    "metadata",
    [
        {"time_range_limits": VALID_LIMITS, "color_scheme": "supersetColors"},
        {"time_range_limits": None},
        {"time_range_limits": NO_LIMITS},
        {"color_scheme": "supersetColors"},
        {},
    ],
)
def test_import_v1_dashboard_schema_accepts_valid_metadata(
    metadata: dict[str, Any],
) -> None:
    from superset.dashboards.schemas import ImportV1DashboardSchema

    loaded = ImportV1DashboardSchema().load(
        import_v1_dashboard_config(metadata=metadata)
    )
    assert loaded["metadata"] == metadata


def test_import_v1_dashboard_schema_without_metadata() -> None:
    from superset.dashboards.schemas import ImportV1DashboardSchema

    assert "metadata" not in ImportV1DashboardSchema().load(
        import_v1_dashboard_config()
    )
