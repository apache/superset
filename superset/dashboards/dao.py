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
from typing import Dict, List, Optional

from flask_appbuilder.models.sqla.interface import SQLAInterface
from sqlalchemy.exc import SQLAlchemyError

from superset.dao.base import (
    generic_create,
    generic_delete,
    generic_update,
    get_owner_by_id,
)
from superset.dashboards.filters import DashboardFilter
from superset.extensions import db
from superset.models.dashboard import Dashboard

logger = logging.getLogger(__name__)


class DashboardDAO:
    @staticmethod
    def get_owner_by_id(owner_id: int) -> Optional[object]:
        return get_owner_by_id(owner_id)

    @staticmethod
    def find_by_id(model_id: int) -> Dashboard:
        data_model = SQLAInterface(Dashboard, db.session)
        query = db.session.query(Dashboard)
        query = DashboardFilter("id", data_model).apply(query, None)
        return query.filter_by(id=model_id).one_or_none()

    @staticmethod
    def find_by_ids(model_ids: List[int]) -> List[Dashboard]:
        query = db.session.query(Dashboard).filter(Dashboard.id.in_(model_ids))
        data_model = SQLAInterface(Dashboard, db.session)
        query = DashboardFilter("id", data_model).apply(query, None)
        return query.all()

    @staticmethod
    def validate_slug_uniqueness(slug: str) -> bool:
        if not slug:
            return True
        dashboard_query = db.session.query(Dashboard).filter(Dashboard.slug == slug)
        return not db.session.query(dashboard_query.exists()).scalar()

    @staticmethod
    def validate_update_slug_uniqueness(dashboard_id: int, slug: str) -> bool:
        dashboard_query = db.session.query(Dashboard).filter(
            Dashboard.slug == slug, Dashboard.id != dashboard_id
        )
        return not db.session.query(dashboard_query.exists()).scalar()

    @staticmethod
    def create(properties: Dict, commit=True) -> Optional[Dashboard]:
        """
        Creates a Dashboard model on the metadata DB
        """
        return generic_create(Dashboard, properties, commit=commit)

    @staticmethod
    def update(model: Dashboard, properties: Dict, commit=True) -> Optional[Dashboard]:
        """
        Update a Dashboard model on the metadata DB
        """
        return generic_update(model, properties, commit=commit)

    @staticmethod
    def delete(model: Dashboard, commit=True):
        """
        Delete a Dashboard model on the metadata DB
        """
        return generic_delete(model, commit=commit)

    @staticmethod
    def bulk_delete(models: List[Dashboard], commit=True):
        item_ids = [model.id for model in models]
        # bulk delete, first delete related data
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
        except SQLAlchemyError as e:
            if commit:
                db.session.rollback()
            raise e
