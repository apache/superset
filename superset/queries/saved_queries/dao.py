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
import uuid

from flask_appbuilder.models.sqla.interface import SQLAInterface
from sqlalchemy.exc import SQLAlchemyError

from superset.dao.base import BaseDAO
from superset.dao.exceptions import DAODeleteFailedError
from superset.extensions import db
from superset.models.sql_lab import SavedQuery
from superset.queries.saved_queries.filters import SavedQueryFilter
from superset.utils.core import is_uuid

logger = logging.getLogger(__name__)


class SavedQueryDAO(BaseDAO):
    model_cls = SavedQuery
    base_filter = SavedQueryFilter

    @staticmethod
    def bulk_delete(models: Optional[List[SavedQuery]], commit: bool = True) -> None:
        item_ids = [model.id for model in models] if models else []
        try:
            db.session.query(SavedQuery).filter(SavedQuery.id.in_(item_ids)).delete(
                synchronize_session="fetch"
            )
            if commit:
                db.session.commit()
        except SQLAlchemyError as ex:
            db.session.rollback()
            raise DAODeleteFailedError() from ex

    @classmethod
    def get_by_id(cls, id: str) -> Optional[SavedQuery]:
        if is_uuid(id):
            return (
                db.session.query(SavedQuery)
                .filter(SavedQuery.uuid == uuid.UUID(id))
                .scalar()
            )
        try:
            query = db.session.query(SavedQuery).filter(SavedQuery.id == int(id))
        except ValueError:  # Invalid id
            return None
        query = cls.base_filter("id", SQLAInterface(SavedQuery, db.session)).apply(
            query, None
        )
        return query.scalar()
