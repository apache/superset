"""update filters for slice model

Revision ID: 53fc3de270ae
Revises: db0c65b146bd
Create Date: 2017-01-31 10:18:49.071296

"""

# revision identifiers, used by Alembic.
revision = '53fc3de270ae'
down_revision = 'db0c65b146bd'

from alembic import op
from superset import db
import json
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Text
import re

Base = declarative_base()


def cast_filter_data(form_data):
    flts = []
    having_flts = []
    fd = form_data
    filter_pattern = re.compile(r'''((?:[^,"']|"[^"]*"|'[^']*')+)''')
    for i in range(0, 10):
        for prefix in ['flt', 'having']:
            col_str = '{}_col_{}'.format(prefix, i)
            op_str = '{}_op_{}'.format(prefix, i)
            val_str = '{}_eq_{}'.format(prefix, i)
            if col_str in fd and op_str in fd and val_str in fd \
               and len(fd[val_str]) > 0:
                f = {}
                f['col'] = fd[col_str]
                f['op'] = fd[op_str]
                if prefix == 'flt':
                    # transfer old strings in filter value to list
                    splitted = filter_pattern.split(fd[val_str])[1::2]
                    values = [types.replace("'", '').strip() for types in splitted]
                    f['val'] = values
                    flts.append(f)
                if prefix == 'having':
                    f['val'] = fd[val_str]
                    having_flts.append(f)
            if col_str in fd:
                del fd[col_str]
            if op_str in fd:
                del fd[op_str]
            if val_str in fd:
                del fd[val_str]
    fd['filters'] = flts
    fd['having_filters'] = having_flts
    return fd


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
