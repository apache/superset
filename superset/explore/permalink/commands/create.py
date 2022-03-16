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
from typing import Any, Dict, Optional

from flask_appbuilder.security.sqla.models import User
from sqlalchemy.exc import SQLAlchemyError

from superset.explore.permalink.commands.base import BaseExplorePermalinkCommand
from superset.explore.permalink.exceptions import ExplorePermalinkCreateFailedError
from superset.explore.utils import check_access
from superset.key_value.commands.create import CreateKeyValueCommand
from superset.key_value.types import KeyType

logger = logging.getLogger(__name__)


class CreateExplorePermalinkCommand(BaseExplorePermalinkCommand):
    def __init__(self, actor: User, state: Dict[str, Any], key_type: KeyType):
        self.actor = actor
        self.chart_id: Optional[int] = state["formData"].get("slice_id")
        self.datasource: str = state["formData"]["datasource"]
        self.state = state
        self.key_type = key_type

    def run(self) -> str:
        self.validate()
        try:
            dataset_id = int(self.datasource.split("__")[0])
            check_access(dataset_id, self.chart_id, self.actor)
            value = {
                "chartId": self.chart_id,
                "datasetId": dataset_id,
                "datasource": self.datasource,
                "state": self.state,
            }
            command = CreateKeyValueCommand(
                self.actor, self.resource, value, self.key_type
            )
            return command.run()
        except SQLAlchemyError as ex:
            logger.exception("Error running create command")
            raise ExplorePermalinkCreateFailedError() from ex

    def validate(self) -> None:
        pass
