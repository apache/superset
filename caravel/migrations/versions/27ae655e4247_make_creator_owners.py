"""Make creator owners

Revision ID: 27ae655e4247
Revises: d8bc074f7aad
Create Date: 2016-06-27 08:43:52.592242

"""

# revision identifiers, used by Alembic.
revision = '27ae655e4247'
down_revision = 'd8bc074f7aad'

from alembic import op
from caravel import db, models


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    objects = session.query(models.Slice).all()
    objects += session.query(models.Dashboard).all()
    for obj in objects:
        if obj.created_by and obj.created_by not in obj.owners:
            obj.owners.append(obj.created_by)
        session.commit()
    session.close()


def downgrade():
    pass
