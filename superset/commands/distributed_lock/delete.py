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
import uuid

from flask import current_app

from superset import db
from superset.commands.distributed_lock.base import BaseDistributedLockCommand
from superset.daos.key_value import KeyValueDAO
from superset.key_value.types import KeyValueResource

logger = logging.getLogger(__name__)
stats_logger = current_app.config["STATS_LOGGER"]

RESOURCE = KeyValueResource.LOCK


class DeleteDistributedLock(BaseDistributedLockCommand):
    key: uuid.UUID

    def validate(self) -> None:
        pass

    def run(self) -> None:
        KeyValueDAO.delete_entry(RESOURCE, self.key)
        db.session.commit()
