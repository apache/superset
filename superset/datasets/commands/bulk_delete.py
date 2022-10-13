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
from typing import List, Optional

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.exceptions import DeleteFailedError
from superset.connectors.sqla.models import SqlaTable
from superset.datasets.commands.exceptions import (
    DatasetBulkDeleteFailedError,
    DatasetForbiddenError,
    DatasetNotFoundError,
)
from superset.datasets.dao import DatasetDAO
from superset.exceptions import SupersetSecurityException
from superset.extensions import db

logger = logging.getLogger(__name__)


class BulkDeleteDatasetCommand(BaseCommand):
    def __init__(self, model_ids: List[int]):
        self._model_ids = model_ids
        self._models: Optional[List[SqlaTable]] = None

    def run(self) -> None:
        self.validate()
        if not self._models:
            return None
        try:
            DatasetDAO.bulk_delete(self._models)
            for model in self._models:
                view_menu = (
                    security_manager.find_view_menu(model.get_perm()) if model else None
                )

                if view_menu:
                    permission_views = (
                        db.session.query(security_manager.permissionview_model)
                        .filter_by(view_menu=view_menu)
                        .all()
                    )

                    for permission_view in permission_views:
                        db.session.delete(permission_view)
                    if view_menu:
                        db.session.delete(view_menu)
                else:
                    if not view_menu:
                        logger.error(
                            "Could not find the data access permission for the dataset",
                            exc_info=True,
                        )
            db.session.commit()

            return None
        except DeleteFailedError as ex:
            logger.exception(ex.exception)
            raise DatasetBulkDeleteFailedError() from ex

    def validate(self) -> None:
        # Validate/populate model exists
        self._models = DatasetDAO.find_by_ids(self._model_ids)
        if not self._models or len(self._models) != len(self._model_ids):
            raise DatasetNotFoundError()
        # Check ownership
        for model in self._models:
            try:
                security_manager.raise_for_ownership(model)
            except SupersetSecurityException as ex:
                raise DatasetForbiddenError() from ex
