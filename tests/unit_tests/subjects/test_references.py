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

from types import SimpleNamespace
from typing import Any
from unittest.mock import Mock, patch

import pytest
from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
from marshmallow import Schema, ValidationError

from superset.charts.schemas import ChartPostSchema, ChartPutSchema
from superset.commands.dashboard.exceptions import DashboardForbiddenError
from superset.commands.dashboard.update import UpdateDashboardCommand
from superset.commands.utils import compute_subjects, populate_subject_list
from superset.dashboards.schemas import DashboardPostSchema, DashboardPutSchema
from superset.datasets.schemas import DatasetPostSchema, DatasetPutSchema
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.reports.schemas import ReportSchedulePostSchema, ReportSchedulePutSchema
from superset.subjects.exceptions import SubjectsNotFoundValidationError
from superset.subjects.models import Subject
from superset.subjects.schemas import SubjectReferenceField
from superset.subjects.types import SubjectType

SCHEMAS = [
    ChartPostSchema,
    ChartPutSchema,
    DashboardPostSchema,
    DashboardPutSchema,
    DatasetPostSchema,
    DatasetPutSchema,
    ReportSchedulePostSchema,
    ReportSchedulePutSchema,
]


@pytest.mark.parametrize("schema_type", SCHEMAS)
@pytest.mark.parametrize("principal_type", ["user", "role", "group", "subject"])
def test_asset_schemas_accept_explicit_references(
    schema_type: type[Schema], principal_type: str
):
    schema = schema_type()
    for name in ("editors", "viewers"):
        if name in schema.fields:
            payload: dict[str, Any] = {name: [{"type": principal_type, "id": 50}, 41]}
            if schema_type is ReportSchedulePostSchema:
                payload["type"] = "Report"
            assert schema.load(payload, partial=True) == payload


@pytest.mark.parametrize(
    "value",
    [
        {"id": 50},
        {"type": "user"},
        {"type": "USER", "id": 50},
        {"type": "user", "id": "50"},
        {"type": "user", "id": True},
        {"type": "user", "id": 50.2},
        {"type": "user", "id": 0},
        {"type": "user", "id": 50, "user_id": 36},
        {"type": 1, "id": 50},
        [],
    ],
)
def test_invalid_references_fail_at_schema(value: Any):
    with pytest.raises(ValidationError):
        DashboardPutSchema().load({"editors": [value]})


def subject(sid: int, user_id: int) -> Subject:
    return Subject(id=sid, user_id=user_id, type=SubjectType.USER, label=str(user_id))


@pytest.mark.parametrize("field", ["editors", "viewers"])
def test_colliding_user_and_subject_ids_resolve_by_explicit_namespace(field: str):
    intended = subject(41, 50)
    other = subject(50, 36)
    model = Dashboard(editors=[], viewers=[])
    with (
        patch("superset.commands.utils.get_user_id", return_value=None),
        patch(
            "superset.commands.utils.security_manager",
            new=SimpleNamespace(is_admin=lambda: True),
        ),
        patch(
            "superset.commands.utils.get_user_subject", return_value=intended
        ) as by_user,
        patch("superset.commands.utils.get_subject", return_value=other) as by_subject,
    ):
        properties = DashboardPutSchema().load({field: [{"type": "user", "id": 50}]})
        errors: list[ValidationError] = []
        compute_subjects(model, properties, errors)
        assert not errors
        assert properties[field] == [intended]
        assert other not in properties[field]
        by_user.assert_called_once_with(50)
        by_subject.assert_not_called()

        # Existing clients still mean Subject 50, which belongs to user 36.
        properties = DashboardPutSchema().load({field: [50]})
        compute_subjects(model, properties, errors)
        assert properties[field] == [other]
        by_subject.assert_called_once_with(50)


def test_unknown_user_never_falls_back_to_colliding_subject():
    with (
        patch("superset.commands.utils.get_user_id", return_value=None),
        patch(
            "superset.commands.utils.security_manager",
            new=SimpleNamespace(is_admin=lambda: True),
        ),
        patch("superset.commands.utils.get_user_subject", return_value=None),
        patch(
            "superset.commands.utils.get_subject", return_value=subject(50, 36)
        ) as lookup,
        pytest.raises(SubjectsNotFoundValidationError),
    ):
        populate_subject_list([{"type": "user", "id": 50}], default_to_user=False)
    lookup.assert_not_called()


@pytest.mark.parametrize(
    "kind,resolver",
    [
        ("role", "get_or_create_role_subject"),
        ("group", "get_or_create_group_subject"),
        ("subject", "get_subject"),
    ],
)
def test_explicit_reference_uses_only_selected_namespace(kind: Any, resolver: str):
    target = Subject(id=99, type=SubjectType.ROLE, label="target")
    with (
        patch("superset.commands.utils.get_user_id", return_value=None),
        patch(
            "superset.commands.utils.security_manager",
            new=SimpleNamespace(is_admin=lambda: True),
        ),
        patch(f"superset.commands.utils.{resolver}", return_value=target) as lookup,
    ):
        assert populate_subject_list([{"type": kind, "id": 50}], False) == [target]
        lookup.assert_called_once_with(50)


def test_typed_editor_keeps_non_admin_lockout_protection():
    caller = subject(41, 50)
    other = subject(75, 60)
    with (
        patch("superset.commands.utils.get_user_id", return_value=50),
        patch(
            "superset.commands.utils.security_manager",
            new=SimpleNamespace(is_admin=lambda: False),
        ),
        patch(
            "superset.commands.utils.get_user_subject",
            side_effect=lambda uid: {50: caller, 60: other}[uid],
        ),
        patch("superset.commands.utils.get_user_subject_ids", return_value=[41]),
        patch(
            "superset.commands.utils._has_extra_editors_resolver", return_value=False
        ),
    ):
        assert populate_subject_list([{"type": "user", "id": 60}], False, True) == [
            caller,
            other,
        ]
        assert populate_subject_list([{"type": "user", "id": 50}], False, True) == [
            caller
        ]


def test_reference_openapi_documents_both_namespaces():
    class InputSchema(Schema):
        editor = SubjectReferenceField()

    spec = APISpec(
        title="test",
        version="1",
        openapi_version="3.0.2",
        plugins=[MarshmallowPlugin()],
    )
    spec.components.schema("Input", schema=InputSchema)
    field = spec.to_dict()["components"]["schemas"]["Input"]["properties"]["editor"]
    assert "type" not in field  # An integer type here would exclude typed objects.
    assert field["oneOf"][0]["type"] == "integer"
    assert field["oneOf"][1]["required"] == ["type", "id"]


def test_unauthorized_update_cannot_resolve_or_create_principals():
    manager = SimpleNamespace(
        raise_for_editorship=Mock(
            side_effect=SupersetSecurityException(
                SupersetError(
                    message="Denied",
                    error_type=SupersetErrorType.GENERIC_BACKEND_ERROR,
                    level=ErrorLevel.ERROR,
                )
            )
        )
    )
    with (
        patch(
            "superset.commands.dashboard.update.DashboardDAO.find_by_id",
            return_value=Dashboard(),
        ),
        patch("superset.commands.dashboard.update.security_manager", new=manager),
        patch("superset.commands.dashboard.update.compute_subjects") as resolve,
        pytest.raises(DashboardForbiddenError),
    ):
        UpdateDashboardCommand(1, {"editors": [{"type": "user", "id": 50}]}).validate()
    resolve.assert_not_called()
