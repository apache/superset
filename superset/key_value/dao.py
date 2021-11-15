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
from datetime import datetime
from typing import Optional

from sqlalchemy.exc import SQLAlchemyError

from superset.dao.exceptions import (
    DAOCreateFailedError,
    DAODeleteFailedError,
    DAOUpdateFailedError,
)
from superset.extensions import db
from superset.models.key_value import KeyValueEntry

logger = logging.getLogger(__name__)

# TODO: Extend from BaseDAO when it supports generic IDs.
class KeyValueDAO:
    @staticmethod
    def find_by_id(id: str) -> Optional[KeyValueEntry]:
        """
        Finds a value that has been stored using a particular key
        """
        try:
            model = db.session.query(KeyValueEntry).filter_by(key=id).one_or_none()
            if model and model.expires_on and datetime.now() > model.expires_on:
                return None
            return model
        except SQLAlchemyError as ex:  # pragma: no cover
            logger.error("Could not get value for the key: %s", str(ex), exc_info=True)
            return None

    @staticmethod
    def create(model: KeyValueEntry) -> KeyValueEntry:
        """
        Creates a value for a particular key
        """
        try:
            db.session.add(model)
            db.session.commit()
            return model
        except SQLAlchemyError as ex:  # pragma: no cover
            db.session.rollback()
            raise DAOCreateFailedError(exception=ex) from ex

    @staticmethod
    def delete(model: KeyValueEntry) -> KeyValueEntry:
        """
        Deletes a value for a particular key
        """
        try:
            db.session.delete(model)
            db.session.commit()
            return model
        except SQLAlchemyError as ex:  # pragma: no cover
            db.session.rollback()
            raise DAODeleteFailedError(exception=ex) from ex

    @staticmethod
    def update(model: KeyValueEntry) -> KeyValueEntry:
        """
        Updates a value for a particular key
        """
        try:
            db.session.merge(model)
            db.session.commit()
            return model
        except SQLAlchemyError as ex:  # pragma: no cover
            db.session.rollback()
            raise DAOUpdateFailedError(exception=ex) from ex
