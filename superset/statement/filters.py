# DODO was here
import logging
from typing import Any

from flask_babel import lazy_gettext as _
from sqlalchemy.orm.query import Query

from superset.models.statement import Statement
from superset.views.base import BaseFilter

logger = logging.getLogger(__name__)


class StatementFinishedFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("finished")
    arg_name = "eq"

    def apply(self, query: Query, value: Any) -> Query:
        if not value == 0:
            if not value:
                return query
        is_finished = bool(int(value))
        return query.filter(Statement.finished.is_(is_finished))


class StatementIDFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("id")
    arg_name = "eq_id_statement"

    def apply(self, query: Query, value: Any) -> Query:
        if value:
            return query.filter(Statement.id == int(value))
        return query


class StatementUserFirstNameFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("first_name")
    arg_name = "ct"

    def apply(self, query: Query, value: Any) -> Query:
        return query.filter(Statement.user.first_name.ilike(value))
