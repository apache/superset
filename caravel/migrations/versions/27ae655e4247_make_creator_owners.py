"""Make creator owners

Revision ID: 27ae655e4247
Revises: d8bc074f7aad
Create Date: 2016-06-27 08:43:52.592242

"""

# revision identifiers, used by Alembic.
revision = '27ae655e4247'
down_revision = 'd8bc074f7aad'

from alembic import op
from caravel import db

from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy import (
    Column, Integer, ForeignKey, Table)

Base = declarative_base()

slice_user = Table(
    'slice_user', Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('user_id', Integer, ForeignKey('ab_user.id')),
    Column('slice_id', Integer, ForeignKey('slices.id'))
)

dashboard_user = Table(
    'dashboard_user', Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('user_id', Integer, ForeignKey('ab_user.id')),
    Column('dashboard_id', Integer, ForeignKey('dashboards.id'))
)


class User(Base):

    """Declarative class to do query in upgrade"""

    __tablename__ = 'ab_user'
    id = Column(Integer, primary_key=True)


class Slice(Base):

    """Declarative class to do query in upgrade"""

    __tablename__ = 'slices'
    id = Column(Integer, primary_key=True)
    owners = relationship("User", secondary=slice_user)
    created_by_fk = Column(Integer)


class Dashboard(Base):

    """Declarative class to do query in upgrade"""

    __tablename__ = 'dashboards'
    id = Column(Integer, primary_key=True)
    owners = relationship("User", secondary=dashboard_user)
    created_by_fk = Column(Integer)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    objects = session.query(Slice).all()
    objects += session.query(Dashboard).all()
    for obj in objects:
        if obj.created_by_fk and obj.created_by_fk not in obj.owners:
            obj.owners.append(obj.created_by_fk)
        session.commit()
    session.close()


def downgrade():
    pass
