# DODO added #32839638

import logging
from typing import Any

from flask_appbuilder.security.sqla.models import User
from flask_babel import lazy_gettext as _
from sqlalchemy import or_
from sqlalchemy.orm.query import Query

from superset.views.base import BaseFilter

logger = logging.getLogger(__name__)


class UserNameFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("first_name")
    arg_name = "usr_name"

    def apply(self, query: Query, value: Any) -> Query:
        if not value:
            return query
        ilike_value = f"%{value}%"
        return query.filter(
            or_(
                User.first_name.ilike(ilike_value),
                User.last_name.ilike(ilike_value),
            )
        )
