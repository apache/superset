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
from __future__ import annotations

from typing import Any, TYPE_CHECKING

from sqlalchemy import and_, or_

from superset import security_manager
from superset.dashboards.filter_sets.consts import DASHBOARD_OWNER_TYPE, USER_OWNER_TYPE
from superset.models.dashboard import dashboard_user
from superset.models.filter_set import FilterSet
from superset.utils.core import get_user_id
from superset.views.base import BaseFilter

if TYPE_CHECKING:
    from sqlalchemy.orm.query import Query


class FilterSetFilter(BaseFilter):  # pylint: disable=too-few-public-methods)
    def apply(self, query: Query, value: Any) -> Query:
        if security_manager.is_admin():
            return query

        filter_set_ids_by_dashboard_owners = (  # pylint: disable=C0103
            query.from_self(FilterSet.id)
            .join(dashboard_user, FilterSet.owner_id == dashboard_user.c.dashboard_id)
            .filter(
                and_(
                    FilterSet.owner_type == DASHBOARD_OWNER_TYPE,
                    dashboard_user.c.user_id == get_user_id(),
                )
            )
        )

        return query.filter(
            or_(
                and_(
                    FilterSet.owner_type == USER_OWNER_TYPE,
                    FilterSet.owner_id == get_user_id(),
                ),
                FilterSet.id.in_(filter_set_ids_by_dashboard_owners),
            )
        )
