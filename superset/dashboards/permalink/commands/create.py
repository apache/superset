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
import json
import logging
from typing import Any, Dict

from flask_appbuilder.security.sqla.models import User
from flask_babel import gettext as _
from sqlalchemy.exc import SQLAlchemyError

from superset.dashboards.dao import DashboardDAO
from superset.dashboards.permalink.commands.base import BaseDashboardPermalinkCommand
from superset.dashboards.permalink.exceptions import (
    DashboardPermalinkCreateFailedError,
    DashboardPermalinkInvalidStateError,
)
from superset.key_value.commands.create import CreateKeyValueCommand
from superset.key_value.types import KeyType

logger = logging.getLogger(__name__)


class CreateDashboardPermalinkCommand(BaseDashboardPermalinkCommand):
    def __init__(
        self, actor: User, id_or_slug: str, state: Dict[str, Any], key_type: KeyType,
    ):
        self.actor = actor
        self.id_or_slug = id_or_slug
        self.state = state
        self.key_type = key_type

    def run(self) -> str:
        self.validate()
        try:
            DashboardDAO.get_by_id_or_slug(self.id_or_slug)
            filter_state = self.state["filter_state"]
            value = json.dumps(
                {"id_or_slug": self.id_or_slug, "filter_state": filter_state,}
            )
            command = CreateKeyValueCommand(
                self.actor, self.resource, value, self.key_type
            )
            key = command.run()
            return key
        except SQLAlchemyError as ex:
            logger.exception("Error running create command")
            raise DashboardPermalinkCreateFailedError() from ex

    def validate(self) -> None:
        if len(self.state) != 1 or "filter_state" not in self.state:
            raise DashboardPermalinkInvalidStateError(message=_("invalid state"))
