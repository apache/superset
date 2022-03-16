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

from flask_appbuilder.security.sqla.models import User
from sqlalchemy.exc import SQLAlchemyError

from superset.dashboards.dao import DashboardDAO
from superset.dashboards.permalink.commands.base import BaseDashboardPermalinkCommand
from superset.dashboards.permalink.exceptions import DashboardPermalinkCreateFailedError
from superset.dashboards.permalink.types import DashboardPermalinkState
from superset.key_value.commands.create import CreateKeyValueCommand
from superset.key_value.types import KeyType

logger = logging.getLogger(__name__)


class CreateDashboardPermalinkCommand(BaseDashboardPermalinkCommand):
    def __init__(
        self,
        actor: User,
        dashboard_id: str,
        state: DashboardPermalinkState,
        key_type: KeyType,
    ):
        self.actor = actor
        self.dashboard_id = dashboard_id
        self.state = state
        self.key_type = key_type

    def run(self) -> str:
        self.validate()
        try:
            DashboardDAO.get_by_id_or_slug(self.dashboard_id)
            value = {
                "dashboardId": self.dashboard_id,
                "state": self.state,
            }
            return CreateKeyValueCommand(
                self.actor, self.resource, value, self.key_type
            ).run()
        except SQLAlchemyError as ex:
            logger.exception("Error running create command")
            raise DashboardPermalinkCreateFailedError() from ex

    def validate(self) -> None:
        pass
