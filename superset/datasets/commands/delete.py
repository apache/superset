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
from typing import Optional

from flask_appbuilder.models.sqla import Model
from flask_appbuilder.security.sqla.models import User
from sqlalchemy.exc import SQLAlchemyError

from superset.commands.base import BaseCommand
from superset.connectors.sqla.models import SqlaTable
from superset.dao.exceptions import DAODeleteFailedError
from superset.datasets.commands.exceptions import (
    DatasetDeleteFailedError,
    DatasetForbiddenError,
    DatasetNotFoundError,
)
from superset.datasets.dao import DatasetDAO
from superset.exceptions import SupersetSecurityException
from superset.extensions import db, security_manager
from superset.views.base import check_ownership

logger = logging.getLogger(__name__)


class DeleteDatasetCommand(BaseCommand):
    def __init__(self, user: User, model_id: int):
        self._actor = user
        self._model_id = model_id
        self._model: Optional[SqlaTable] = None

    def run(self) -> Model:
        self.validate()
        try:
            dataset = DatasetDAO.delete(self._model, commit=False)

            view_menu = (
                security_manager.find_view_menu(self._model.get_perm())
                if self._model
                else None
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
                        "Could not find the data access permission for the dataset"
                    )
            db.session.commit()
        except (SQLAlchemyError, DAODeleteFailedError) as ex:
            logger.exception(ex)
            db.session.rollback()
            raise DatasetDeleteFailedError()
        return dataset

    def validate(self) -> None:
        # Validate/populate model exists
        self._model = DatasetDAO.find_by_id(self._model_id)
        if not self._model:
            raise DatasetNotFoundError()
        # Check ownership
        try:
            check_ownership(self._model)
        except SupersetSecurityException:
            raise DatasetForbiddenError()
