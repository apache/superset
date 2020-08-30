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
import re
from typing import Any, AnyStr, List, Set, Tuple

from sqlalchemy.engine.base import Connection
from sqlalchemy.orm.base import NEVER_SET, NO_VALUE

from superset import security_manager, typing
from superset.constants import Security as SecurityConsts

logger = logging.getLogger(__name__)


class SecuredMixin:
    previous_title = None

    @property
    def view_name(self) -> str:
        return SecurityConsts.Dashboard.VIEW_NAME_FORMAT.format(obj=self)

    @property
    def permission_view_pairs(self) -> List[Tuple[str, str]]:
        return [(SecurityConsts.Dashboard.ACCESS_PERMISSION_NAME, self.view_name)]


ID_REGEX_PATTERN = r"\(id:(?P<id>\d+)\)$"
id_finder = re.compile(ID_REGEX_PATTERN)


class DashboardSecurityManager:
    @staticmethod
    def can_access_all() -> bool:
        return security_manager.can_access(
            SecurityConsts.AllDashboard.ACCESS_PERMISSION_NAME,
            SecurityConsts.AllDashboard.VIEW_NAME,
        )

    @classmethod
    def get_access_list(cls):  # type: ignore
        view_names = security_manager.user_view_menu_names(
            SecurityConsts.Dashboard.ACCESS_PERMISSION_NAME
        )
        return set(map(cls.parse_id_from_view_name, view_names))

    @staticmethod
    def parse_id_from_view_name(view_name):  # type: ignore
        matched = id_finder.search(view_name)
        if matched:
            return matched.group("id")


class DashboardSecurityOrientedDBEventsHandler:
    @staticmethod
    def after_insert(  # pylint: disable=unused-argument
        mapper: Any, connection: Connection, target: "Dashboard"  # type: ignore
    ) -> None:
        try:
            logger.info("in after insert on %s %d", target, target.id)
            security_manager.set_permissions_views(
                connection, target.permission_view_pairs
            )
        except Exception as ex:
            logger.error(ex)

    @staticmethod
    def on_set(  # pylint: disable=unused-argument
        dashboard: "Dashboard", new_title: str, old_title: str, event: Any  # type: ignore
    ) -> None:
        dashboard.previous_title = old_title

    @staticmethod
    def after_update(  # pylint: disable=unused-argument
        mapper: Any, connection: Connection, target: "Dashboard"  # type: ignore
    ) -> None:
        previous_title = target.previous_title
        new_title = target.dashboard_title
        if target.previous_title in {NEVER_SET, NO_VALUE}:
            DashboardSecurityOrientedDBEventsHandler.after_insert(
                mapper, connection, target
            )
        elif previous_title and previous_title != new_title:
            new_perm = target.view_name
            old_perm = new_perm.replace(new_title, previous_title)
            security_manager.change_view_name_by_connection(
                connection, new_perm, old_perm
            )
        target.previous_title = None

    @staticmethod
    def after_delete(  # pylint: disable=unused-argument
        mapper: Any, connection: Connection, target: "Dashboard"  # type: ignore
    ) -> None:
        try:
            logger.info("in after delete on %s %d", target, target.id)
            security_manager.delete_permissions_views(
                connection, target.permission_view_pairs
            )
        except Exception as ex:
            logger.error(ex)
