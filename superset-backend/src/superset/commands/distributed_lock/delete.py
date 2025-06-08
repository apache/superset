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

from flask import current_app
from sqlalchemy.exc import SQLAlchemyError

from superset.commands.distributed_lock.base import BaseDistributedLockCommand
from superset.daos.key_value import KeyValueDAO
from superset.exceptions import DeleteKeyValueDistributedLockFailedException
from superset.key_value.exceptions import KeyValueDeleteFailedError
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)
stats_logger = current_app.config["STATS_LOGGER"]


class DeleteDistributedLock(BaseDistributedLockCommand):
    def validate(self) -> None:
        pass

    @transaction(
        on_error=partial(
            on_error,
            catches=(
                KeyValueDeleteFailedError,
                SQLAlchemyError,
            ),
            reraise=DeleteKeyValueDistributedLockFailedException,
        ),
    )
    def run(self) -> None:
        KeyValueDAO.delete_entry(self.resource, self.key)
