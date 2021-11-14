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
from typing import Any, Dict

from flask_appbuilder.models.sqla import Model
from sqlalchemy.exc import SQLAlchemyError

from superset.dao.base import BaseDAO
from superset.dao.exceptions import DAOConfigError, DAOCreateFailedError
from superset.dashboards.filter_sets.consts import (
    DASHBOARD_ID_FIELD,
    DESCRIPTION_FIELD,
    JSON_METADATA_FIELD,
    NAME_FIELD,
    OWNER_ID_FIELD,
    OWNER_TYPE_FIELD,
)
from superset.extensions import db
from superset.models.filter_set import FilterSet

logger = logging.getLogger(__name__)


class FilterSetDAO(BaseDAO):
    model_cls = FilterSet

    @classmethod
    def create(cls, properties: Dict[str, Any], commit: bool = True) -> Model:
        if cls.model_cls is None:
            raise DAOConfigError()
        model = FilterSet()
        setattr(model, NAME_FIELD, properties[NAME_FIELD])
        setattr(model, JSON_METADATA_FIELD, properties[JSON_METADATA_FIELD])
        setattr(model, DESCRIPTION_FIELD, properties.get(DESCRIPTION_FIELD, None))
        setattr(
            model,
            OWNER_ID_FIELD,
            properties.get(OWNER_ID_FIELD, properties[DASHBOARD_ID_FIELD]),
        )
        setattr(model, OWNER_TYPE_FIELD, properties[OWNER_TYPE_FIELD])
        setattr(model, DASHBOARD_ID_FIELD, properties[DASHBOARD_ID_FIELD])
        try:
            db.session.add(model)
            if commit:
                db.session.commit()
        except SQLAlchemyError as ex:  # pragma: no cover
            db.session.rollback()
            raise DAOCreateFailedError() from ex
        return model
