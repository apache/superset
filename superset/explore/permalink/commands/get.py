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

from superset.datasets.commands.exceptions import DatasetNotFoundError
from superset.explore.permalink.commands.base import BaseExplorePermalinkCommand
from superset.explore.permalink.exceptions import ExplorePermalinkGetFailedError
from superset.explore.permalink.types import ExplorePermalinkValue
from superset.explore.utils import check_access
from superset.key_value.commands.get import GetKeyValueCommand
from superset.key_value.exceptions import KeyValueGetFailedError, KeyValueParseKeyError
from superset.key_value.utils import decode_permalink_id

logger = logging.getLogger(__name__)


class GetExplorePermalinkCommand(BaseExplorePermalinkCommand):
    def __init__(self, actor: User, key: str):
        self.actor = actor
        self.key = key

    def run(self) -> Optional[ExplorePermalinkValue]:
        self.validate()
        try:
            key = decode_permalink_id(self.key, salt=self.salt)
            value: Optional[ExplorePermalinkValue] = GetKeyValueCommand(
                resource=self.resource,
                key=key,
            ).run()
            if value:
                chart_id: Optional[int] = value.get("chartId")
                dataset_id = value["datasetId"]
                check_access(dataset_id, chart_id, self.actor)
                return value
            return None
        except (
            DatasetNotFoundError,
            KeyValueGetFailedError,
            KeyValueParseKeyError,
        ) as ex:
            raise ExplorePermalinkGetFailedError(message=ex.message) from ex
        except SQLAlchemyError as ex:
            logger.exception("Error running get command")
            raise ExplorePermalinkGetFailedError() from ex

    def validate(self) -> None:
        pass
