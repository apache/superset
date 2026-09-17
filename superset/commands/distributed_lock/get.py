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

from __future__ import annotations

import logging
from typing import cast

from flask import current_app

from superset.commands.distributed_lock.base import BaseDistributedLockCommand
from superset.daos.key_value import KeyValueDAO
from superset.distributed_lock.types import LockValue

logger = logging.getLogger(__name__)
stats_logger = current_app.config["STATS_LOGGER"]


class GetDistributedLock(BaseDistributedLockCommand):
    def validate(self) -> None:
        pass

    def run(self) -> LockValue | None:
        entry = KeyValueDAO.get_entry(
            resource=self.resource,
            key=self.key,
        )
        if not entry or entry.is_expired():
            return None

        return cast(LockValue, self.codec.decode(entry.value))
