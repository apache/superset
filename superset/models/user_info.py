from sqlalchemy import Column, String, ForeignKey, Integer
from flask_appbuilder import Model

from superset import db
from superset.utils.core import get_user_id


class UserInfo(Model):  # DODO added #33835937

    """Extra info about user"""

    __tablename__ = "user_info"

    id = Column(Integer, primary_key=True)
    language = Column(String(32), default="ru")
    user_id = Column(Integer, ForeignKey("ab_user.id"))
