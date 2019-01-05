"""smaller_grid
Revision ID: e866bd2d4976
Revises: 21e88bc06c02
Create Date: 2018-02-13 08:07:40.766277
"""
import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy.ext.declarative import declarative_base
from flask_appbuilder.models.mixins import AuditMixin

from superset import db

revision = 'e866bd2d4976'
down_revision = '21e88bc06c02'

Base = declarative_base()
RATIO = 4

class Dashboard(Base):
    """Declarative class to do query in upgrade"""
    __tablename__ = 'dashboards'
    id = sa.Column(sa.Integer, primary_key=True)
    position_json = sa.Column(sa.Text)
    dashboard_title = sa.Column(sa.String(500))


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    dashboards = session.query(Dashboard).all()
    for i, dashboard in enumerate(dashboards):
        print('Upgrading ({}/{}): {}'.format(
            i, len(dashboards), dashboard.id))
        positions = json.loads(dashboard.position_json or '{}')
        for pos in positions:
            if pos.get('v', 0) == 0:
                pos['size_x'] = pos['size_x'] * RATIO
                pos['size_y'] = pos['size_y'] * RATIO
                pos['col'] = ((pos['col'] - 1) * RATIO) + 1
                pos['row'] = pos['row'] * RATIO
                pos['v'] = 1

        dashboard.position_json = json.dumps(positions, indent=2)
        session.merge(dashboard)
        session.commit()

    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    dashboards = session.query(Dashboard).all()
    for i, dashboard in enumerate(dashboards):
        print('Downgrading ({}/{}): {}'.format(
            i, len(dashboards), dashboard.id))
        positions = json.loads(dashboard.position_json or '{}')
        for pos in positions:
            if pos.get('v', 0) == 1:
                pos['size_x'] = pos['size_x'] / 4
                pos['size_y'] = pos['size_y'] / 4
                pos['col'] = ((pos['col'] - 1) / 4) + 1
                pos['row'] = pos['row'] / 4
                pos['v'] = 0

        dashboard.position_json = json.dumps(positions, indent=2)
        session.merge(dashboard)
        session.commit()
    pass
