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
"""Create, read, update and delete saved widgets."""

from __future__ import annotations

from functools import partial
from typing import Any

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.widget.exceptions import (
    SavedWidgetCreateFailedError,
    SavedWidgetDeleteFailedError,
    SavedWidgetForbiddenError,
    SavedWidgetNotFoundError,
    SavedWidgetUpdateFailedError,
)
from superset.commands.widget.utils import (
    load_saved_widget,
    raise_for_widget_ownership,
    validate_widget_props,
)
from superset.daos.saved_widget import SavedWidgetDAO
from superset.models.saved_widget import SavedWidget
from superset.utils import json
from superset.utils.core import get_user_id
from superset.utils.decorators import on_error, transaction
from superset.widgets.data import props_dataset_id


def _props_attributes(props: dict[str, Any]) -> dict[str, Any]:
    return {"props": json.dumps(props), "dataset_id": props_dataset_id(props)}


class CreateSavedWidgetCommand(BaseCommand):
    def __init__(self, data: dict[str, Any]) -> None:
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=SavedWidgetCreateFailedError))
    def run(self) -> SavedWidget:
        self.validate()
        return SavedWidgetDAO.create(
            attributes={
                "widget_type": self._properties["widget_type"],
                "title": self._properties.get("title"),
                **_props_attributes(self._properties["props"]),
            }
        )

    def validate(self) -> None:
        if security_manager.is_guest_user():
            raise SavedWidgetForbiddenError()
        validate_widget_props(
            self._properties.get("widget_type"), self._properties.get("props")
        )


class UpdateSavedWidgetCommand(BaseCommand):
    def __init__(self, ref: str, data: dict[str, Any]) -> None:
        self._ref = ref
        self._properties = data.copy()
        self._model: SavedWidget | None = None

    @transaction(on_error=partial(on_error, reraise=SavedWidgetUpdateFailedError))
    def run(self) -> SavedWidget:
        self.validate()
        assert self._model is not None
        attributes: dict[str, Any] = {}
        if "props" in self._properties:
            attributes.update(_props_attributes(self._properties["props"]))
        if "title" in self._properties:
            attributes["title"] = self._properties["title"]
        return SavedWidgetDAO.update(self._model, attributes=attributes)

    def validate(self) -> None:
        self._model = SavedWidgetDAO.find_by_uuid(self._ref)
        if self._model is None:
            raise SavedWidgetNotFoundError(self._ref)
        raise_for_widget_ownership(self._model)
        if "props" in self._properties:
            validate_widget_props(self._model.widget_type, self._properties["props"])


class DeleteSavedWidgetCommand(BaseCommand):
    def __init__(self, ref: str) -> None:
        self._ref = ref
        self._model: SavedWidget | None = None

    @transaction(on_error=partial(on_error, reraise=SavedWidgetDeleteFailedError))
    def run(self) -> None:
        self.validate()
        assert self._model is not None
        SavedWidgetDAO.delete([self._model])

    def validate(self) -> None:
        self._model = SavedWidgetDAO.find_by_uuid(self._ref)
        if self._model is None:
            raise SavedWidgetNotFoundError(self._ref)
        raise_for_widget_ownership(self._model)


class GetSavedWidgetCommand(BaseCommand):
    def __init__(self, ref: str) -> None:
        self._ref = ref

    def run(self) -> SavedWidget:
        return load_saved_widget(self._ref)

    def validate(self) -> None:
        pass


class ListSavedWidgetsCommand(BaseCommand):
    """Admins see every saved widget; anyone else their own."""

    def run(self) -> list[SavedWidget]:
        self.validate()
        if security_manager.is_admin():
            return SavedWidgetDAO.find_all()
        user_id = get_user_id()
        return SavedWidgetDAO.find_by_creator(user_id) if user_id is not None else []

    def validate(self) -> None:
        if security_manager.is_guest_user():
            raise SavedWidgetForbiddenError()
