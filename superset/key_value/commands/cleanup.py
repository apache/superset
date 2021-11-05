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
from datetime import datetime, timedelta

from superset.commands.base import BaseCommand
from superset.models.key_value import KeyValue
from superset.key_value.dao import KeyValueDAO
from superset.key_value.utils import is_expired
from superset.utils.celery import session_scope

logger = logging.getLogger(__name__)


class CleanupCommand(BaseCommand):
    """
    Expiration cleanup command.
    """

    def __init__(self, worker_context: bool = True):
        self._worker_context = worker_context

    def run(self) -> None:
        logger.info("Key value store cleanup starting")
        with session_scope(nullpool=True) as session:
           for keyValue in session.query(KeyValue).all():
                if is_expired(keyValue):
                    KeyValueDAO.delete(keyValue.key)
                    logger.info("Deleted expired value: %s", keyValue.key)
        logger.info("Key value store cleanup ended")

    def validate(self) -> None:
        pass
