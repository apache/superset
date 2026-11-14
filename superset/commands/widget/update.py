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
import logging
from functools import partial
from typing import Any, Optional

from marshmallow import ValidationError
from sqlalchemy.orm.exc import StaleDataError

from superset import db, security_manager
from superset.commands.base import BaseCommand, UpdateMixin
from superset.commands.utils import compute_subjects
from superset.commands.widget.exceptions import (
    WidgetForbiddenError,
    WidgetInvalidError,
    WidgetNotFoundError,
    WidgetRevisionConflictError,
    WidgetUpdateFailedError,
)
from superset.daos.widget import WidgetDAO
from superset.exceptions import SupersetSecurityException
from superset.utils.decorators import on_error, transaction
from superset.widgets.models import Widget

logger = logging.getLogger(__name__)


class UpdateWidgetCommand(UpdateMixin, BaseCommand):
    """
    Update a saved widget.

    When ``expected_revision`` is given (from the ``If-Match`` header), the
    update only applies if the widget is still at that revision.
    """

    def __init__(
        self,
        widget_uuid: str,
        data: dict[str, Any],
        expected_revision: Optional[int] = None,
    ):
        self._widget_uuid = widget_uuid
        self._properties = data.copy()
        self._expected_revision = expected_revision
        self._model: Optional[Widget] = None

    @transaction(on_error=partial(on_error, reraise=WidgetUpdateFailedError))
    def run(self) -> Widget:
        self.validate()
        assert self._model
        current_revision = self._model.revision
        self._properties["revision"] = current_revision + 1
        widget = WidgetDAO.update(self._model, self._properties)
        try:
            db.session.flush()
        except StaleDataError as ex:
            # Another writer committed between our read and this UPDATE.
            db.session.rollback()
            latest = WidgetDAO.find_by_id(self._widget_uuid, id_column="uuid")
            raise WidgetRevisionConflictError(
                latest.revision if latest else current_revision
            ) from ex
        return widget

    def validate(self) -> None:
        self._model = WidgetDAO.find_by_id(self._widget_uuid, id_column="uuid")
        if not self._model:
            raise WidgetNotFoundError(self._widget_uuid)

        # Check editorship on the persisted model first, so that a non-editor
        # cannot PUT themselves onto the editors list.
        try:
            security_manager.raise_for_editorship(self._model)
        except SupersetSecurityException as ex:
            raise WidgetForbiddenError() from ex

        if (
            self._expected_revision is not None
            and self._expected_revision != self._model.revision
        ):
            raise WidgetRevisionConflictError(self._model.revision)

        exceptions: list[ValidationError] = []
        compute_subjects(self._model, self._properties, exceptions)
        if exceptions:
            raise WidgetInvalidError(exceptions=exceptions)
