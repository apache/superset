"""dash json add time_range

Revision ID: 388242a6da7e
Revises: c18bd4186f15
Create Date: 2018-08-03 15:26:58.524367

"""

import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy.ext.declarative import declarative_base

from superset import db

# revision identifiers, used by Alembic.
revision = '388242a6da7e'
down_revision = 'c18bd4186f15'

Base = declarative_base()


class Dashboard(Base):
    """Declarative class to do query in upgrade"""
    __tablename__ = 'dashboards'
    id = sa.Column(sa.Integer, primary_key=True)
    json_metadata = sa.Column(sa.Text)


def upgrade():

    bind = op.get_bind()
    session = db.Session(bind=bind)

    dashboards = session.query(Dashboard).all()
    for i, dashboard in enumerate(dashboards):
        print('Upgrading ({}/{}): {}'.format(
            i + 1, len(dashboards), dashboard.id))
        metadata = json.loads(dashboard.json_metadata or '{}')
        default_filters = json.loads(metadata.get('default_filters') or '{}')

        for filter_id in default_filters:
            filter = default_filters[filter_id]
            if '__from' in filter or '__to' in filter:
                time_range = '{} : {}'.format(
                    filter.get('__from', ''), filter.get('__to', ''))
                default_filters[filter_id] = {'__time_range': time_range}

        metadata['default_filters'] = json.dumps(default_filters, indent=2)
        dashboard.json_metadata = json.dumps(metadata, indent=2)
        session.merge(dashboard)
        session.commit()

    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    dashboards = session.query(Dashboard).all()
    for i, dashboard in enumerate(dashboards):
        print('Downgrading ({}/{}): {}'.format(
            i + 1, len(dashboards), dashboard.id))
        metadata = json.loads(dashboard.json_metadata or '{}')
        default_filters = json.loads(metadata.get('default_filters') or '{}')

        for filter_id in default_filters:
            filter = default_filters[filter_id]
            if '__time_range' in filter:
                time_range_array = filter['__time_range'].split(' : ')
                try:
                    date_from = time_range_array[0]
                    date_to = time_range_array[1]
                    default_filters[filter_id] = {
                        '__from': date_from,
                        '__to': date_to,
                    }
                except IndexError:
                    print("Can't downgrade filter")

        metadata['default_filters'] = json.dumps(default_filters, indent=2)
        dashboard.json_metadata = json.dumps(metadata, indent=2)
        session.merge(dashboard)
        session.commit()

    session.close()

