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

from flask_appbuilder.security.sqla.models import User

from superset.commands.base import BaseCommand, CommandValidateReturn
from superset.datasets.commands.exceptions import (
    DatasetDeleteFailedError,
    DatasetNotFoundError,
)
from superset.datasets.dao import DatasetDAO
from superset.views.base import check_ownership


class DeleteDatasetCommand(BaseCommand):
    def __init__(self, user: User, model_id: int):
        self._actor = user
        self._model_id = model_id
        self._model = None

    def run(self):
        self._model = DatasetDAO.find_by_id(self._model_id)
        if not self._model:
            raise DatasetNotFoundError()
        self.validate()
        dataset = DatasetDAO.delete(self._model)

        if not dataset:
            raise DatasetDeleteFailedError()
        return dataset

    def validate(self) -> CommandValidateReturn:
        is_valid, exceptions = super().validate()
        check_ownership(self._model)
        return is_valid, exceptions
