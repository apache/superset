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
from typing import List, Optional

from sqlalchemy.exc import SQLAlchemyError

from superset.dao.base import BaseDAO
from superset.dashboards.filters import DashboardFilter
from superset.extensions import db
from superset.models.dashboard import Dashboard

logger = logging.getLogger(__name__)


class DashboardDAO(BaseDAO):
    model_cls = Dashboard
    base_filter = DashboardFilter

    @staticmethod
    def validate_slug_uniqueness(slug: str) -> bool:
        if not slug:
            return True
        dashboard_query = db.session.query(Dashboard).filter(Dashboard.slug == slug)
        return not db.session.query(dashboard_query.exists()).scalar()

    @staticmethod
    def validate_update_slug_uniqueness(dashboard_id: int, slug: Optional[str]) -> bool:
        if slug is not None:
            dashboard_query = db.session.query(Dashboard).filter(
                Dashboard.slug == slug, Dashboard.id != dashboard_id
            )
            return not db.session.query(dashboard_query.exists()).scalar()
        return True

    @staticmethod
    def update_charts_owners(model: Dashboard, commit: bool = True) -> Dashboard:
        owners = list(model.owners)
        for slc in model.slices:
            slc.owners = list(set(owners) | set(slc.owners))
        if commit:
            db.session.commit()
        return model

    @staticmethod
    def bulk_delete(models: Optional[List[Dashboard]], commit: bool = True) -> None:
        item_ids = [model.id for model in models] if models else []
        # bulk delete, first delete related data
        if models:
            for model in models:
                model.slices = []
                model.owners = []
                db.session.merge(model)
        # bulk delete itself
        try:
            db.session.query(Dashboard).filter(Dashboard.id.in_(item_ids)).delete(
                synchronize_session="fetch"
            )
            if commit:
                db.session.commit()
        except SQLAlchemyError as ex:
            if commit:
                db.session.rollback()
            raise ex
