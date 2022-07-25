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
from typing import List, Optional, Union

from sqlalchemy.exc import SQLAlchemyError

from superset.dao.base import BaseDAO
from superset.dao.exceptions import DAODeleteFailedError
from superset.extensions import db
from superset.models.annotations import Annotation, AnnotationLayer

logger = logging.getLogger(__name__)


class AnnotationLayerDAO(BaseDAO):
    model_cls = AnnotationLayer

    @staticmethod
    def bulk_delete(
        models: Optional[List[AnnotationLayer]], commit: bool = True
    ) -> None:
        item_ids = [model.id for model in models] if models else []
        try:
            db.session.query(AnnotationLayer).filter(
                AnnotationLayer.id.in_(item_ids)
            ).delete(synchronize_session="fetch")
            if commit:
                db.session.commit()
        except SQLAlchemyError as ex:
            db.session.rollback()
            raise DAODeleteFailedError() from ex

    @staticmethod
    def has_annotations(model_id: Union[int, List[int]]) -> bool:
        if isinstance(model_id, list):
            return (
                db.session.query(AnnotationLayer)
                .filter(AnnotationLayer.id.in_(model_id))
                .join(Annotation)
                .first()
            ) is not None
        return (
            db.session.query(AnnotationLayer)
            .filter(AnnotationLayer.id == model_id)
            .join(Annotation)
            .first()
        ) is not None

    @staticmethod
    def validate_update_uniqueness(name: str, layer_id: Optional[int] = None) -> bool:
        """
        Validate if this layer name is unique. `layer_id` is optional
        and serves for validating on updates

        :param name: The annotation layer name
        :param layer_id: The annotation layer current id
        (only for validating on updates)
        :return: bool
        """
        query = db.session.query(AnnotationLayer).filter(AnnotationLayer.name == name)
        if layer_id:
            query = query.filter(AnnotationLayer.id != layer_id)
        return not db.session.query(query.exists()).scalar()
