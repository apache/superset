"""unify metric format

Revision ID: 2e78904069a1
Revises: 55e910a74826
Create Date: 2018-12-11 11:08:43.574789

"""

# revision identifiers, used by Alembic.
revision = '2e78904069a1'
down_revision = '55e910a74826'

import json

from alembic import op
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Text

from superset import db
from superset.legacy import cast_form_data

METRIC_KEYS = [
    'metric', 'metrics', 'percent_metrics', 'metric_2', 'secondary_metric',
    'x', 'y', 'size',
]

Base = declarative_base()


class Slice(Base):
    """Declarative class to do query in upgrade"""
    __tablename__ = 'slices'
    id = Column(Integer, primary_key=True)
    datasource_type = Column(String(200))
    slice_name = Column(String(200))
    params = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    slices = session.query(Slice).all()
    slice_len = len(slices)
    for i, slc in enumerate(slices):
        try:
            d = json.loads(slc.params or '{}')
            for mkey in METRIC_KEYS:
              val = fd.get(mkey)
              if val:
                  if not isinstance(val, list):
                      val = [val]
                  for o in val:
                      label = self.get_metric_label(o)
                      if isinstance(o, dict):
                          o['label'] = label
                      self.metric_dict[label] = o
            slc.params = json.dumps(d, indent=2, sort_keys=True)
            session.merge(slc)
            session.commit()
            print('Upgraded ({}/{}): {}'.format(i, slice_len, slc.slice_name))
        except Exception as e:
            print(slc.slice_name + ' error: ' + str(e))

    session.close()


def downgrade():
    pass