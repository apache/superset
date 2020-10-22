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
from superset.dao.exceptions import DAODeleteFailedError
from superset.extensions import db
from superset.models.annotations import Annotation

logger = logging.getLogger(__name__)


class AnnotationDAO(BaseDAO):
    model_cls = Annotation

    @staticmethod
    def bulk_delete(models: Optional[List[Annotation]], commit: bool = True) -> None:
        item_ids = [model.id for model in models] if models else []
        try:
            db.session.query(Annotation).filter(Annotation.id.in_(item_ids)).delete(
                synchronize_session="fetch"
            )
            if commit:
                db.session.commit()
        except SQLAlchemyError:
            if commit:
                db.session.rollback()
            raise DAODeleteFailedError()

    @staticmethod
    def validate_update_uniqueness(
        layer_id: int, short_descr: str, annotation_id: Optional[int] = None
    ):
        """
        Validate if this annotation short description is unique. `id` is optional
        and serves for validating on updates

        :param short_descr: The annotation short description
        :param layer_id: The annotation layer current id
        :param annotation_id: This annotation is (only for validating on updates)
        :return: bool
        """
        query = db.session.query(Annotation).filter(
            Annotation.short_descr == short_descr, Annotation.layer_id == layer_id
        )
        if annotation_id:
            query = query.filter(Annotation.id != annotation_id)
        return not db.session.query(query.exists()).scalar()
