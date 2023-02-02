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
from typing import cast, Optional

from flask_appbuilder.models.sqla import Model

from superset import security_manager
from superset.charts.dao import ChartDAO
from superset.commands.base import BaseCommand
from superset.utils.core import get_user_id
from superset.utils.dates import datetime_to_epoch

logger = logging.getLogger(__name__)


class GetUserSlicesCommand(BaseCommand):
    _user_id: Optional[int]

    def __init__(self, user_id: Optional[int] = None):
        self._user_id = user_id

    def run(self) -> Model:
        self.validate()

        slices = ChartDAO.user_slices(cast(int, self._user_id))

        payload = []
        for o in slices:
            item = {
                "id": o.Slice.id,
                "title": o.Slice.slice_name,
                "url": o.Slice.slice_url,
                "data": o.Slice.form_data,
                "dttm": datetime_to_epoch(
                    o.FavStar.dttm if o.FavStar else o.Slice.changed_on
                ),
                "viz_type": o.Slice.viz_type,
                "is_favorite": bool(o.FavStar),
            }
            if o.Slice.created_by:
                user = o.Slice.created_by
                item["creator"] = str(user)
                item["creator_url"] = "/superset/profile/{}/".format(user.username)
            payload.append(item)

        return payload

    def validate(self) -> None:
        if not self._user_id:
            self._user_id = get_user_id()

        security_manager.raise_for_user_activity_access(self._user_id)
