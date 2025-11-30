# from typing import Any

# from flask_babel import lazy_gettext as _
# from sqlalchemy import and_, or_
# from sqlalchemy.orm import aliased
# from sqlalchemy.orm.query import Query

# from superset.views.base import BaseFilter

# class NotDeletedUserFilter(BaseFilter):
#     #Filter out deleted users when getting all users
#     name = "Filter non-deleted users"

#     def apply(self, query, value):
#         from superset.models.user_attributes import UserAttribute
#         query.join(
#             UserAttribute, 
#             UserAttribute.user_id == self.model.id
#             ).filter(UserAttribute.deleted.is_(False))