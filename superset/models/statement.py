# DODO added #32839641
from datetime import datetime

from flask_appbuilder import Model
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
)
from sqlalchemy.orm import relationship

from superset import security_manager

metadata = Model.metadata  # pylint: disable=no-member

statement_user = Table(
    "statement_user",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("statement_id", ForeignKey("statements.id")),
    Column("user_id", ForeignKey("ab_user.id")),
)


statement_roles = Table(
    "statement_roles",
    metadata,
    Column("id", Integer, primary_key=True),
    Column(
        "statement_id",
        Integer,
        ForeignKey("statements.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column(
        "role_id",
        Integer,
        ForeignKey("ab_role.id", ondelete="CASCADE"),
        nullable=False,
    ),
)


class Statement(Model):  # pylint: disable=too-few-public-methods
    """Dodo teams for Superset"""

    __tablename__ = "statements"

    id = Column(Integer, primary_key=True)
    user = relationship(
        security_manager.user_model,
        secondary=statement_user,
        passive_deletes=True,
        backref="statements",
    )
    finished = Column(Boolean, default=False)
    team = Column(String, nullable=False)
    is_new_team = Column(Boolean, default=False)
    team_slug = Column(String, nullable=False)
    is_external = Column(Boolean, nullable=False)
    created_datetime = Column(DateTime, default=datetime.utcnow())
    request_roles = relationship(security_manager.role_model, secondary=statement_roles)
    last_changed_datetime = Column(DateTime, default=datetime.utcnow())
