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
from __future__ import annotations

import logging
from datetime import datetime
from typing import TYPE_CHECKING

from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset.charts.filters import ChartFilter
from superset.commands.chart.exceptions import ChartNotFoundError
from superset.daos.base import BaseDAO
from superset.extensions import db
from superset.models.core import FavStar, FavStarClassName
from superset.models.slice import id_or_uuid_filter, Slice
from superset.utils.core import get_user_id

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class ChartDAO(BaseDAO[Slice]):
    base_filter = ChartFilter

    @staticmethod
    def get_by_id_or_uuid(id_or_uuid: str) -> Slice:
        query = db.session.query(Slice).filter(id_or_uuid_filter(id_or_uuid))
        # Apply chart base filters
        query = ChartFilter("id", SQLAInterface(Slice, db.session)).apply(query, None)
        chart = query.one_or_none()
        if not chart:
            raise ChartNotFoundError()
        return chart

    @staticmethod
    def favorited_ids(charts: list[Slice]) -> list[FavStar]:
        ids = [chart.id for chart in charts]
        return [
            star.obj_id
            for star in db.session.query(FavStar.obj_id)
            .filter(
                FavStar.class_name == FavStarClassName.CHART,
                FavStar.obj_id.in_(ids),
                FavStar.user_id == get_user_id(),
            )
            .all()
        ]

    @staticmethod
    def add_favorite(chart: Slice) -> None:
        ids = ChartDAO.favorited_ids([chart])
        if chart.id not in ids:
            db.session.add(
                FavStar(
                    class_name=FavStarClassName.CHART,
                    obj_id=chart.id,
                    user_id=get_user_id(),
                    dttm=datetime.now(),
                )
            )

    @staticmethod
    def remove_favorite(chart: Slice) -> None:
        fav = (
            db.session.query(FavStar)
            .filter(
                FavStar.class_name == FavStarClassName.CHART,
                FavStar.obj_id == chart.id,
                FavStar.user_id == get_user_id(),
            )
            .one_or_none()
        )
        if fav:
            db.session.delete(fav)
