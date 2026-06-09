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

from superset.commands.base import BaseCommand
from superset.commands.folder.exceptions import (
    FolderDeleteFailedError,
    FolderNotFoundError,
)
from superset.daos.folder import FolderDAO
from superset.folders.models import Folder
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class DeleteFolderCommand(BaseCommand):
    def __init__(self, folder_id_or_uuid: str):
        self._id = folder_id_or_uuid
        self._model: Optional[Folder] = None

    @transaction(on_error=partial(on_error, reraise=FolderDeleteFailedError))
    def run(self) -> None:
        self.validate()
        assert self._model
        FolderDAO.delete_folder(self._model)

    def validate(self) -> None:
        self._model = FolderDAO.find_by_id_or_uuid(self._id)
        if not self._model:
            raise FolderNotFoundError()
