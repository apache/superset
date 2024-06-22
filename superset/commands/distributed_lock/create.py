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
from datetime import datetime, timedelta

from flask import current_app
from sqlalchemy.exc import IntegrityError

from superset import db
from superset.commands.distributed_lock.base import BaseDistributedLockCommand
from superset.daos.key_value import KeyValueDAO
from superset.exceptions import CreateKeyValueDistributedLockFailedException
from superset.key_value.types import JsonKeyValueCodec, KeyValueResource

logger = logging.getLogger(__name__)
stats_logger = current_app.config["STATS_LOGGER"]


class CreateDistributedLock(BaseDistributedLockCommand):
    key: uuid.UUID
    lock_expiration = timedelta(seconds=30)
    resource = KeyValueResource.LOCK
    codec = JsonKeyValueCodec()

    def validate(self) -> None:
        pass

    def run(self) -> None:
        try:
            KeyValueDAO.delete_expired_entries(self.resource)
            KeyValueDAO.create_entry(
                resource=KeyValueResource.LOCK,
                value=True,
                codec=self.codec,
                key=self.key,
                expires_on=datetime.now() + self.lock_expiration,
            )
            db.session.commit()
        except IntegrityError as ex:
            db.session.rollback()
            raise CreateKeyValueDistributedLockFailedException(
                "Lock already taken"
            ) from ex
