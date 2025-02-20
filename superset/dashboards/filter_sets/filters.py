# dodo added 44211751
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


class FilterSetFilterByUser(BaseFilter):  # pylint: disable=too-few-public-methods)
    def apply(self, query: Query, value: Any) -> Query:
        return query.filter(
            and_(
                FilterSet.user_id == get_user_id(),
            )
        )
