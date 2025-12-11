from flask_appbuilder.security.sqla.models import User
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
)

class SupersetUser(User):
    __tablename__ = "ab_user"

    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_on = Column(DateTime)

