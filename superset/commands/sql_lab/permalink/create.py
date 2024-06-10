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
from typing import Any

from superset.commands.key_value.create import CreateKeyValueCommand
from superset.commands.sql_lab.permalink.base import BaseSqlLabPermalinkCommand
from superset.key_value.exceptions import KeyValueCodecEncodeException
from superset.key_value.utils import encode_permalink_key
from superset.sqllab.permalink.exceptions import SqlLabPermalinkCreateFailedError

logger = logging.getLogger(__name__)


class CreateSqlLabPermalinkCommand(BaseSqlLabPermalinkCommand):
    def __init__(self, state: dict[str, Any]):
        self._properties = state.copy()

    def run(self) -> str:
        self.validate()
        try:
            command = CreateKeyValueCommand(
                resource=self.resource,
                value=self._properties,
                codec=self.codec,
            )
            key = command.run()
            if key.id is None:
                raise SqlLabPermalinkCreateFailedError("Unexpected missing key id")
            return encode_permalink_key(key=key.id, salt=self.salt)
        except KeyValueCodecEncodeException as ex:
            raise SqlLabPermalinkCreateFailedError(str(ex)) from ex

    def validate(self) -> None:
        pass
