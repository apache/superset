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
from typing import Any, Dict, List, Optional

from flask_appbuilder.models.sqla import Model 
from flask_appbuilder.security.sqla.models import User
from marshmallow import ValidationError

from supereset.queries.saved_queries.commands.exceptions import SavedQueryCreateError, SavedQueryInvalidError
from superset.queries.saved_queries.dao import SavedQueryDAO
from superset.commands.base import BaseCommand
from superset.commands.utils import get_datasource_by_id
from superset.dao.exceptions import DAOCreateFailedError

logger = logging.getLogger(__name__)

class CreateSavedQueryCommand(BaseCommand):
    def __init__(self, user: User, data: Dict[str, Any]):
        self._actor = user
        self._properties = data.copy()

    def run(self) -> Model:
        self.validate()
        try:
            saved_query = SavedQueryDAO.create(self._properties)
        except DAOCreateFailedError as ex:
            logger.exception(ex._exception)
            raise SavedQueryCreateError
        return saved_query

    def validate(self) -> None:
        exceptions = list()
        datasource_type = self._properties["datasource_type"]
        datasource_id = self._properties["datasource_id"]
        owner_ids: Optional[List[int]] = self._properties.get("owners")

        try:
            datasource = get_datasource_by_id(datasource_id, datasource_type)
            self._properties["datasource_name"] = datasource.name
        except ValidationError as ex:
            exceptions.append(ex)
