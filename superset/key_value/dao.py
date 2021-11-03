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
from uuid import UUID
from typing import Optional

from sqlalchemy.exc import SQLAlchemyError
from superset.extensions import db
from superset.models.core import KeyValuePair

logger = logging.getLogger(__name__)

# TODO: Extend from BaseDAO when it supports generic IDs.
class KeyValueDAO:

    @staticmethod
    def find_by_id(id: UUID) -> Optional[UUID]:
        """
        Finds a value that has been stored using a particular UUID
        """
        try:
            return db.session.query(KeyValuePair).filter_by(key=id).one_or_none()
        except SQLAlchemyError as ex:  # pragma: no cover
            logger.error("Could not get value by UUID: %s", str(ex), exc_info=True)
            return None

    @staticmethod
    def create(id: UUID, value: str) -> Optional[KeyValuePair]:
        """
        Creates a value for a particular UUID
        """
        model = KeyValuePair(key=id, value=value)
        db.session.add(model)
        db.session.commit()
        return model

    @staticmethod
    def delete(id: UUID) -> None:
        """
        Deletes a value for a particular UUID
        """
        model = KeyValueDAO.find_by_id(id)
        db.session.delete(model)
        db.session.commit()

    @staticmethod
    def update(model: KeyValuePair) -> Optional[KeyValuePair]:
        """
        Updates a value for a particular UUID
        """
        db.session.merge(model)
        db.session.commit()
