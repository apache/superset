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
from typing import Any, Optional

from sqlalchemy.exc import SQLAlchemyError

from superset.commands.explore.permalink.base import BaseExplorePermalinkCommand
from superset.commands.key_value.create import CreateKeyValueCommand
from superset.explore.permalink.exceptions import ExplorePermalinkCreateFailedError
from superset.explore.utils import check_access as check_chart_access
from superset.key_value.exceptions import KeyValueCodecEncodeException
from superset.key_value.utils import encode_permalink_key
from superset.utils.core import DatasourceType

logger = logging.getLogger(__name__)


class CreateExplorePermalinkCommand(BaseExplorePermalinkCommand):
    def __init__(self, state: dict[str, Any]):
        self.chart_id: Optional[int] = state["formData"].get("slice_id")
        self.datasource: str = state["formData"]["datasource"]
        self.state = state

    def run(self) -> str:
        self.validate()
        try:
            d_id, d_type = self.datasource.split("__")
            datasource_id = int(d_id)
            datasource_type = DatasourceType(d_type)
            check_chart_access(datasource_id, self.chart_id, datasource_type)
            value = {
                "chartId": self.chart_id,
                "datasourceId": datasource_id,
                "datasourceType": datasource_type.value,
                "datasource": self.datasource,
                "state": self.state,
            }
            command = CreateKeyValueCommand(
                resource=self.resource,
                value=value,
                codec=self.codec,
            )
            key = command.run()
            if key.id is None:
                raise ExplorePermalinkCreateFailedError("Unexpected missing key id")
            return encode_permalink_key(key=key.id, salt=self.salt)
        except KeyValueCodecEncodeException as ex:
            raise ExplorePermalinkCreateFailedError(str(ex)) from ex
        except SQLAlchemyError as ex:
            logger.exception("Error running create command")
            raise ExplorePermalinkCreateFailedError() from ex

    def validate(self) -> None:
        pass
