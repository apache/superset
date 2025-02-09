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
from functools import partial

from sqlalchemy.exc import SQLAlchemyError

from superset import db
from superset.commands.dashboard.permalink.base import BaseDashboardPermalinkCommand
from superset.daos.dashboard import DashboardDAO
from superset.daos.key_value import KeyValueDAO
from superset.dashboards.permalink.exceptions import DashboardPermalinkCreateFailedError
from superset.dashboards.permalink.types import DashboardPermalinkState
from superset.key_value.exceptions import (
    KeyValueCodecEncodeException,
    KeyValueUpsertFailedError,
)
from superset.key_value.utils import encode_permalink_key, get_deterministic_uuid
from superset.utils.core import get_user_id
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CreateDashboardPermalinkCommand(BaseDashboardPermalinkCommand):
    """
    Get or create a permalink key for the dashboard.

    The same dashboard_id and state for the same user will return the
    same permalink.
    """

    def __init__(
        self,
        dashboard_id: str,
        state: DashboardPermalinkState,
    ):
        self.dashboard_id = dashboard_id
        self.state = state

    @transaction(
        on_error=partial(
            on_error,
            catches=(
                KeyValueCodecEncodeException,
                KeyValueUpsertFailedError,
                SQLAlchemyError,
            ),
            reraise=DashboardPermalinkCreateFailedError,
        ),
    )
    def run(self) -> str:
        self.validate()
        dashboard = DashboardDAO.get_by_id_or_slug(self.dashboard_id)
        print("creating permalink...")

        print(self.state)
        
        value = {
            "dashboardId": str(dashboard.uuid),
            "state": self.state,
            # "state": {**self.state, "urlParams": [['native_filter', '(NATIVE_FILTER-8jS1fx4hl:(extraFormData:(filters:!((col:country_name,op:IN,val:!(Brazil)))),filterState:(label:country_name,validateStatus:!f,value:!(Brazil)),id:NATIVE_FILTER-8jS1fx4hl,ownState:()))']]},
        }
        user_id = get_user_id()
        
        print('.' * 10)
        print(self.resource)
        print(user_id)
        print(value)
        print(self.codec)   
        print('.' * 10)
        
        entry = KeyValueDAO.upsert_entry(
            resource=self.resource,
            key=get_deterministic_uuid(self.salt, (user_id, value)),
            value=value,
            codec=self.codec,
        )
        db.session.flush()
        assert entry.id  # for type checks
        
        hash = encode_permalink_key(key=entry.id, salt=self.salt)
        print("permalink created")
        print(hash)
        
        return hash

    def validate(self) -> None:
        pass
