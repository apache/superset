"""Materializing permission

Revision ID: c3a8f8611885
Revises: 4fa88fe24e94
Create Date: 2016-04-25 08:54:04.303859

"""

# revision identifiers, used by Alembic.
revision = 'c3a8f8611885'
down_revision = '4fa88fe24e94'

from alembic import op
import sqlalchemy as sa
from caravel import db
from caravel import models


def upgrade():
    bind = op.get_bind()
    op.add_column('slices', sa.Column('perm', sa.String(length=2000), nullable=True))
    session = db.Session(bind=bind)

    for slc in session.query(models.Slice).all():
        if slc.datasource:
            slc.perm = slc.datasource.perm
            session.merge(slc)
            session.commit()
    db.session.close()


def downgrade():
    op.drop_column('slices', 'perm')
