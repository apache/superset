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
from typing import Optional

from sqlalchemy.exc import SQLAlchemyError

from superset.dao.exceptions import (
    DAOCreateFailedError,
    DAODeleteFailedError,
    DAOUpdateFailedError,
)
from superset.dashboards.dao import DashboardDAO
from superset.extensions import cache_manager
from superset.key_value.utils import cache_key

logger = logging.getLogger(__name__)


class KeyValueDAO:
    @staticmethod
    def find_by_id(dashboard_id: int, key: str) -> Optional[str]:
        """
        Finds a value that has been stored using a particular key
        """
        try:
            dashboard = DashboardDAO.get_by_id_or_slug(str(dashboard_id))
            if dashboard:
                return cache_manager.filters_state_cache.get(
                    cache_key(dashboard_id, key)
                )
        except SQLAlchemyError as ex:  # pragma: no cover
            logger.error("Could not get value for the key: %s", str(ex), exc_info=True)
        return None

    @staticmethod
    def create(dashboard_id: int, key: str, value: str) -> Optional[bool]:
        """
        Creates a value for a particular key
        """
        try:
            dashboard = DashboardDAO.get_by_id_or_slug(str(dashboard_id))
            if dashboard:
                return cache_manager.filters_state_cache.set(
                    cache_key(dashboard_id, key), value
                )
        except SQLAlchemyError as ex:  # pragma: no cover
            raise DAOCreateFailedError(exception=ex) from ex
        return False

    @staticmethod
    def delete(dashboard_id: int, key: str) -> Optional[bool]:
        """
        Deletes a value for a particular key
        """
        try:
            dashboard = DashboardDAO.get_by_id_or_slug(str(dashboard_id))
            if dashboard:
                return cache_manager.filters_state_cache.delete(
                    cache_key(dashboard_id, key)
                )
        except SQLAlchemyError as ex:  # pragma: no cover
            raise DAODeleteFailedError(exception=ex) from ex
        return False

    @staticmethod
    def update(dashboard_id: int, key: str, value: str) -> Optional[bool]:
        """
        Updates a value for a particular key
        """
        try:
            dashboard = DashboardDAO.get_by_id_or_slug(str(dashboard_id))
            if dashboard:
                return cache_manager.filters_state_cache.set(
                    cache_key(dashboard_id, key), value
                )
        except SQLAlchemyError as ex:  # pragma: no cover
            raise DAOUpdateFailedError(exception=ex) from ex
        return False
