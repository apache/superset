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
from typing import Optional

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.widget.exceptions import (
    WidgetDeleteFailedError,
    WidgetForbiddenError,
    WidgetNotFoundError,
)
from superset.daos.widget import WidgetDAO
from superset.exceptions import SupersetSecurityException
from superset.utils.decorators import on_error, transaction
from superset.widgets.models import Widget

logger = logging.getLogger(__name__)


class DeleteWidgetCommand(BaseCommand):
    def __init__(self, widget_uuid: str):
        self._widget_uuid = widget_uuid
        self._model: Optional[Widget] = None

    @transaction(on_error=partial(on_error, reraise=WidgetDeleteFailedError))
    def run(self) -> None:
        self.validate()
        assert self._model
        WidgetDAO.delete([self._model])

    def validate(self) -> None:
        self._model = WidgetDAO.find_by_id(self._widget_uuid, id_column="uuid")
        if not self._model:
            raise WidgetNotFoundError(self._widget_uuid)

        try:
            security_manager.raise_for_editorship(self._model)
        except SupersetSecurityException as ex:
            raise WidgetForbiddenError() from ex
