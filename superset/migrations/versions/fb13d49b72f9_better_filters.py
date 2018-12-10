"""better_filters

Revision ID: fb13d49b72f9
Revises: 6c7537a6004a
Create Date: 2018-12-11 22:03:21.612516

"""
import json
import logging

from alembic import op
from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db

# revision identifiers, used by Alembic.
revision = 'fb13d49b72f9'
down_revision = 'de021a1ca60d'

Base = declarative_base()


class Slice(Base):
    __tablename__ = 'slices'

    id = Column(Integer, primary_key=True)
    params = Column(Text)
    viz_type = Column(String(250))
    slice_name = Column(String(250))


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    filter_box_slices = session.query(Slice).filter_by(viz_type='filter_box')
    for slc in filter_box_slices.all():
        try:
            params = json.loads(slc.params)
            logging.info(f'Upgrading {slc.slice_name}')
            cols = params.get('groupby')
            metrics = params.get('metrics')
            if cols:
                flts = [{
                    'column': col,
                    'metric': metrics[0] if metrics else None,
                    'asc': False,
                    'clearable': True,
                    'multiple': True,
                } for col in cols]
                params['filter_configs'] = flts
                if 'groupby' in params:
                    del params['groupby']
                if 'metrics' in params:
                    del params['metrics']
                slc.params = json.dumps(params, sort_keys=True)
        except Exception as e:
            logging.exception(e)

    session.commit()
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    filter_box_slices = session.query(Slice).filter_by(viz_type='filter_box')
    for slc in filter_box_slices.all():
        try:
            params = json.loads(slc.params)
            logging.info(f'Downgrading {slc.slice_name}')
            flts = params.get('filter_configs')
            if not flts:
                continue
            params['metrics'] = [flts[0].get('metric')]
            params['groupby'] = [o.get('column') for o in flts]
            slc.params = json.dumps(params, sort_keys=True)
        except Exception as e:
            logging.exception(e)

    session.commit()
    session.close()
