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
from __future__ import annotations

from functools import partial
from typing import Any

from marshmallow import ValidationError

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.dashboard_v2.exceptions import (
    DashboardV2ForbiddenError,
    DashboardV2InvalidError,
    DashboardV2NotFoundError,
    DashboardV2SaveFailedError,
)
from superset.commands.utils import populate_subjects
from superset.daos.dashboard import DashboardDAO
from superset.dashboard_v2.document import (
    DocumentValidationError,
    LeafWidget,
    load_stored_document,
    normalize_document,
    write_stored_document,
)
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.utils import json
from superset.utils.decorators import on_error, transaction
from superset.widgets.registry import registry


def validate_leaf_props(leaves: list[LeafWidget]) -> dict[str, Any]:
    """Run each registered widget type's commit-time validation over its props."""
    errors: dict[str, Any] = {}
    for leaf in leaves:
        widget_cls = registry.get(leaf.widget_type)
        if widget_cls is None:
            continue
        if leaf_errors := widget_cls.validate_control_values(leaf.props):
            errors[leaf.node_id] = leaf_errors
    return errors


def _normalize_and_validate(document: Any) -> dict[str, Any]:
    try:
        stored, leaves = normalize_document(document)
    except DocumentValidationError as ex:
        raise DashboardV2InvalidError(str(ex)) from ex
    if errors := validate_leaf_props(leaves):
        raise DashboardV2InvalidError("Widget props failed validation.", errors)
    return stored


class CreateDashboardV2Command(BaseCommand):
    def __init__(self, data: dict[str, Any]) -> None:
        self._properties = data.copy()
        self._stored: dict[str, Any] = {}

    @transaction(on_error=partial(on_error, reraise=DashboardV2SaveFailedError))
    def run(self) -> Dashboard:
        self.validate()
        return DashboardDAO.create(
            attributes={
                "dashboard_title": self._properties["dashboard_title"],
                "json_metadata": write_stored_document(json.dumps({}), self._stored),
                "editors": self._properties["editors"],
            }
        )

    def validate(self) -> None:
        self._stored = _normalize_and_validate(self._properties["document"])
        exceptions: list[ValidationError] = []
        populate_subjects(self._properties, exceptions, include_viewers=False)
        if exceptions:
            raise DashboardV2InvalidError(
                "Invalid editors.",
                {"editors": [exception.messages for exception in exceptions]},
            )


class UpdateDashboardV2Command(BaseCommand):
    def __init__(self, pk: int, data: dict[str, Any]) -> None:
        self._pk = pk
        self._properties = data.copy()
        self._model: Dashboard | None = None
        self._stored: dict[str, Any] = {}

    @transaction(on_error=partial(on_error, reraise=DashboardV2SaveFailedError))
    def run(self) -> Dashboard:
        self.validate()
        assert self._model is not None
        attributes: dict[str, Any] = {
            "json_metadata": write_stored_document(
                self._model.json_metadata, self._stored
            )
        }
        if title := self._properties.get("dashboard_title"):
            attributes["dashboard_title"] = title
        return DashboardDAO.update(self._model, attributes=attributes)

    def validate(self) -> None:
        self._model = DashboardDAO.find_by_id(self._pk)
        if (
            self._model is None
            or load_stored_document(self._model.json_metadata) is None
        ):
            raise DashboardV2NotFoundError(str(self._pk))
        try:
            security_manager.raise_for_editorship(self._model)
        except SupersetSecurityException as ex:
            raise DashboardV2ForbiddenError() from ex
        self._stored = _normalize_and_validate(self._properties["document"])
