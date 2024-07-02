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

from superset.commands.key_value.get import GetKeyValueCommand
from superset.commands.sql_lab.permalink.base import BaseSqlLabPermalinkCommand
from superset.key_value.exceptions import (
    KeyValueCodecDecodeException,
    KeyValueGetFailedError,
    KeyValueParseKeyError,
)
from superset.key_value.utils import decode_permalink_id
from superset.sqllab.permalink.exceptions import SqlLabPermalinkGetFailedError
from superset.sqllab.permalink.types import SqlLabPermalinkValue

logger = logging.getLogger(__name__)


class GetSqlLabPermalinkCommand(BaseSqlLabPermalinkCommand):
    def __init__(self, key: str):
        self.key = key

    def run(self) -> Optional[SqlLabPermalinkValue]:
        self.validate()
        try:
            key = decode_permalink_id(self.key, salt=self.salt)
            value: Optional[SqlLabPermalinkValue] = GetKeyValueCommand(
                resource=self.resource,
                key=key,
                codec=self.codec,
            ).run()
            if value:
                return value
            return None
        except (
            KeyValueCodecDecodeException,
            KeyValueGetFailedError,
            KeyValueParseKeyError,
        ) as ex:
            raise SqlLabPermalinkGetFailedError(message=ex.message) from ex

    def validate(self) -> None:
        pass
