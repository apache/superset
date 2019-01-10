"""single pie chart metric

Revision ID: 80a67c5192fa
Revises: afb7730f6a9c
Create Date: 2018-06-14 14:31:06.624370

"""

# revision identifiers, used by Alembic.
revision = '80a67c5192fa'
down_revision = 'afb7730f6a9c'


import json

from alembic import op
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Text

from superset import db


Base = declarative_base()


class Slice(Base):
    __tablename__ = 'slices'

    id = Column(Integer, primary_key=True)
    params = Column(Text)
    viz_type = Column(String(250))


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in session.query(Slice).filter(Slice.viz_type == 'pie').all():
        try:
            params = json.loads(slc.params)

            if 'metrics' in params:
                if params['metrics']:
                    params['metric'] = params['metrics'][0]

                del params['metrics']
                slc.params = json.dumps(params, sort_keys=True)
        except Exception:
            pass

    session.commit()
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in session.query(Slice).filter(Slice.viz_type == 'pie').all():
        try:
            params = json.loads(slc.params)

            if 'metric' in params:
                if params['metric']:
                    params['metrics'] = [params['metric']]

                del params['metric']
                slc.params = json.dumps(params, sort_keys=True)
        except Exception:
            pass

    session.commit()
    session.close()
