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

from flask_appbuilder.security.sqla.models import User
from sqlalchemy.exc import SQLAlchemyError

from superset.dashboards.commands.exceptions import DashboardNotFoundError
from superset.dashboards.dao import DashboardDAO
from superset.dashboards.permalink.commands.base import BaseDashboardPermalinkCommand
from superset.dashboards.permalink.exceptions import DashboardPermalinkGetFailedError
from superset.dashboards.permalink.types import DashboardPermalinkValue
from superset.key_value.commands.get import GetKeyValueCommand
from superset.key_value.exceptions import KeyValueGetFailedError, KeyValueParseKeyError
from superset.key_value.types import KeyType

logger = logging.getLogger(__name__)


class GetDashboardPermalinkCommand(BaseDashboardPermalinkCommand):
    def __init__(
        self, actor: User, key: str, key_type: KeyType,
    ):
        self.actor = actor
        self.key = key
        self.key_type = key_type

    def run(self) -> Optional[DashboardPermalinkValue]:
        self.validate()
        try:
            command = GetKeyValueCommand(
                self.resource, self.key, key_type=self.key_type
            )
            value: Optional[DashboardPermalinkValue] = command.run()
            if value:
                DashboardDAO.get_by_id_or_slug(value["dashboardId"])
                return value
            return None
        except (
            DashboardNotFoundError,
            KeyValueGetFailedError,
            KeyValueParseKeyError,
        ) as ex:
            raise DashboardPermalinkGetFailedError(message=ex.message) from ex
        except SQLAlchemyError as ex:
            logger.exception("Error running get command")
            raise DashboardPermalinkGetFailedError() from ex

    def validate(self) -> None:
        pass
