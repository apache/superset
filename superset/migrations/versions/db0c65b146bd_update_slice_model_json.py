"""update_slice_model_json

Revision ID: db0c65b146bd
Revises: f18570e03440
Create Date: 2017-01-24 12:31:06.541746

"""

# revision identifiers, used by Alembic.
revision = 'db0c65b146bd'
down_revision = 'f18570e03440'

from alembic import op
import json
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Text

from superset import db
from superset.legacy import cast_form_data

Base = declarative_base()


class Slice(Base):
    """Declarative class to do query in upgrade"""
    __tablename__ = 'slices'
    id = Column(Integer, primary_key=True)
    datasource_type = Column(String(200))
    params = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in session.query(Slice).all():
        d = json.loads(slc.params)
        d = cast_form_data(d)
        slc.params = json.dumps(d)
        session.merge(slc)
        session.commit()
    session.close()


def downgrade():
    pass
