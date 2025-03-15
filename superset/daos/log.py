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
from datetime import datetime, timedelta
from typing import Any

import humanize
from sqlalchemy import and_, or_
from sqlalchemy.sql import functions as func

from superset import db
from superset.daos.base import BaseDAO
from superset.models.core import Log
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils.core import get_user_id
from superset.utils.dates import datetime_to_epoch


class LogDAO(BaseDAO[Log]):
    @staticmethod
    def get_recent_activity(
        actions: list[str],
        distinct: bool,
        page: int,
        page_size: int,
    ) -> list[dict[str, Any]]:
        user_id = get_user_id()
        has_subject_title = or_(
            and_(
                Dashboard.dashboard_title is not None,
                Dashboard.dashboard_title != "",
            ),
            and_(Slice.slice_name is not None, Slice.slice_name != ""),
        )

        if distinct:
            one_year_ago = datetime.today() - timedelta(days=365)
            subqry = (
                db.session.query(
                    Log.dashboard_id,
                    Log.slice_id,
                    Log.action,
                    func.max(Log.dttm).label("dttm"),
                )
                .group_by(Log.dashboard_id, Log.slice_id, Log.action)
                .filter(
                    and_(
                        Log.action == "log",
                        Log.user_id == user_id,
                        or_(
                            *{
                                Log.json.contains(f'"event_name": "{action}"')
                                for action in actions
                            },
                        ),
                        # limit to one year of data to improve performance
                        Log.dttm > one_year_ago,
                        or_(Log.dashboard_id.isnot(None), Log.slice_id.isnot(None)),
                    )
                )
                .subquery()
            )
            qry = (
                db.session.query(
                    subqry,
                    Dashboard.slug.label("dashboard_slug"),
                    Dashboard.dashboard_title,
                    Slice.slice_name,
                )
                .outerjoin(Dashboard, Dashboard.id == subqry.c.dashboard_id)
                .outerjoin(
                    Slice,
                    Slice.id == subqry.c.slice_id,
                )
                .filter(has_subject_title)
                .order_by(subqry.c.dttm.desc())
                .limit(page_size)
                .offset(page * page_size)
            )
        else:
            qry = (
                db.session.query(
                    Log.dttm,
                    Log.action,
                    Log.dashboard_id,
                    Log.slice_id,
                    Dashboard.slug.label("dashboard_slug"),
                    Dashboard.dashboard_title,
                    Slice.slice_name,
                )
                .outerjoin(Dashboard, Dashboard.id == Log.dashboard_id)
                .outerjoin(Slice, Slice.id == Log.slice_id)
                .filter(has_subject_title)
                .filter(
                    Log.action == "log",
                    Log.user_id == user_id,
                    or_(
                        *{
                            Log.json.contains(f'"event_name": "{action}"')
                            for action in actions
                        },
                    ),
                )
                .order_by(Log.dttm.desc())
                .limit(page_size)
                .offset(page * page_size)
            )

        payload = []
        for log in qry.all():
            item_url = None
            item_title = None
            item_type = None
            if log.dashboard_id:
                item_type = "dashboard"
                item_url = Dashboard.get_url(log.dashboard_id, log.dashboard_slug)
                item_title = log.dashboard_title
            elif log.slice_id:
                item_type = "slice"
                item_url = Slice.build_explore_url(log.slice_id)
                item_title = log.slice_name or "<empty>"

            payload.append(
                {
                    "action": log.action,
                    "item_type": item_type,
                    "item_url": item_url,
                    "item_title": item_title,
                    "time": datetime_to_epoch(log.dttm),
                    "time_delta_humanized": humanize.naturaltime(
                        datetime.utcnow() - log.dttm
                    ),
                }
            )
        return payload
