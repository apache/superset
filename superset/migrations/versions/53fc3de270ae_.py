"""update filters for slice model

Revision ID: 53fc3de270ae
Revises: db0c65b146bd
Create Date: 2017-01-31 10:18:49.071296

"""

# revision identifiers, used by Alembic.
revision = '53fc3de270ae'
down_revision = 'db0c65b146bd'

from alembic import op
from superset import db, cast_filter_data
import json
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Text

Base = declarative_base()


class Slice(Base):
    """Declarative class to do query in upgrade"""
    __tablename__ = 'slices'
    id = Column(Integer, primary_key=True)
    datasource_id = Column(Integer)
    druid_datasource_id = Column(Integer)
    table_id = Column(Integer)
    datasource_type = Column(String(200))
    params = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in session.query(Slice).all():
        d = json.loads(slc.params)
        d = cast_filter_data(d)
        slc.params = json.dumps(d)
        session.merge(slc)
        session.commit()
    session.close()


def downgrade():
    pass
