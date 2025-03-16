# DODO added #32839638

import logging
from typing import Any

from flask_babel import lazy_gettext as _
from sqlalchemy.orm.query import Query

from superset.models.team import Team
from superset.views.base import BaseFilter

logger = logging.getLogger(__name__)


class TeamIDFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("id")
    arg_name = "eq_id_team"

    def apply(self, query: Query, value: Any) -> Query:
        if value:
            return query.filter(Team.id == int(value))
        return query


class TeamNameFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("Name")
    arg_name = "ct_name"

    def apply(self, query: Query, value: Any) -> Query:
        if not value:
            return query
        ilike_value = f"%{value}%"
        return query.filter(Team.name.ilike(ilike_value))


class TeamSlugFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("Slug")
    arg_name = "ct_slug"

    def apply(self, query: Query, value: Any) -> Query:
        if not value:
            return query
        ilike_value = f"%{value}%"
        return query.filter(Team.slug.ilike(ilike_value))


class TeamExternalFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("External")
    arg_name = "eq_external"

    def apply(self, query: Query, value: Any) -> Query:
        if not value == 0:
            if not value:
                return query
        is_external = bool(int(value))
        return query.filter(Team.is_external.is_(is_external))
