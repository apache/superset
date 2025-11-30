from typing import Any

from flask_babel import lazy_gettext as _

from flask_appbuilder.models.filters import BaseFilter

class NotDeletedUserFilter(BaseFilter):
    #Filter out deleted users when getting all users
    name = "Filter non-deleted users"

    def apply(self, query, value):
        from superset.models.user import SupersetUser
        return query.filter(SupersetUser.__table__.c.is_deleted.is_(False))
    

