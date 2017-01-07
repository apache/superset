"""Add number of views as column to dashboards and slices

Revision ID: 1b2c3f7c96f9
Revises: 6414e83d82b7
Create Date: 2016-12-15 16:32:31.909331

"""

# revision identifiers, used by Alembic.
revision = '1b2c3f7c96f9'
down_revision = '6414e83d82b7'

from alembic import op
import sqlalchemy as sa
from superset import db, models

def upgrade():
  op.add_column('dashboards', sa.Column('views', sa.Integer, server_default='1', nullable=True))
  op.add_column('slices', sa.Column('views', sa.Integer, server_default='1', nullable=True))

  if db.engine.name != 'postgresql':
    Dash = models.Dashboard
    Log = models.Log
    qry = (
      db.session.query(
          Dash,
          sa.func.count(),
      )
      .outerjoin(Log)
      .filter(
          sa.and_(
              Log.dashboard_id == Dash.id,
          )
      )
      .group_by(Dash)
    )
    for dash_obj in qry.all():
      dash_obj[0].views = dash_obj[1]
    db.session.commit()

    Slice = models.Slice
    qry = (
      db.session.query(
          Slice,
          sa.func.count(),
      )
      .outerjoin(Log)
      .filter(
          sa.and_(
              Log.slice_id == Slice.id,
          )
      )
      .group_by(Slice)
    )
    for slice_obj in qry.all():
      slice_obj[0].views = slice_obj[1]
    db.session.commit()
    db.session.close()



def downgrade():
  op.drop_column('dashboards', 'views')
  op.drop_column('slices', 'views')
