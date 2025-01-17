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

from sqlalchemy.exc import SQLAlchemyError

from superset.commands.dashboard.exceptions import DashboardNotFoundError
from superset.commands.dashboard.permalink.base import BaseDashboardPermalinkCommand
from superset.daos.dashboard import DashboardDAO
from superset.daos.key_value import KeyValueDAO
from superset.dashboards.permalink.exceptions import DashboardPermalinkGetFailedError
from superset.dashboards.permalink.types import DashboardPermalinkValue
from superset.key_value.exceptions import (
    KeyValueCodecDecodeException,
    KeyValueGetFailedError,
    KeyValueParseKeyError,
)
from superset.key_value.utils import decode_permalink_id

logger = logging.getLogger(__name__)


class GetDashboardPermalinkCommand(BaseDashboardPermalinkCommand):
    def __init__(self, key: str):
        self.key = key

    def run(self) -> Optional[DashboardPermalinkValue]:
        self.validate()
        try:
            key = decode_permalink_id(self.key, salt=self.salt)
            value = KeyValueDAO.get_value(self.resource, key, self.codec)
            if value:
                DashboardDAO.get_by_id_or_slug(value["dashboardId"])
                return value
            return None
        except (
            DashboardNotFoundError,
            KeyValueCodecDecodeException,
            KeyValueGetFailedError,
            KeyValueParseKeyError,
        ) as ex:
            raise DashboardPermalinkGetFailedError(message=ex.message) from ex
        except SQLAlchemyError as ex:
            logger.exception("Error running get command")
            raise DashboardPermalinkGetFailedError() from ex

    def validate(self) -> None:
        pass
