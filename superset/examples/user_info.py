# DODO added #33835937
from superset import db, security_manager
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class UserInfo(Base):
    """Declarative class to do query in upgrade"""

    __tablename__ = "user_info"

    id = Column(Integer, primary_key=True)
    language = Column(String(32), default="ru")
    user_id = Column(Integer, ForeignKey("ab_user.id"))


class User(Base):
    """Declarative class to do query in upgrade"""

    __tablename__ = "ab_user"
    id = Column(Integer, primary_key=True)


def load_user_info():
    users = (
        db.session.query(security_manager.user_model)
        .all()
    )
    users_id = {user.id: UserInfo(id=i+1, language="ru", user_id=user.id)
                for i, user in enumerate(users)
                }
    try:
        db.session.add_all(users_id.values())
        db.session.commit()
    except Exception as e:
        pass
