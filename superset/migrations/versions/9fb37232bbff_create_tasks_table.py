"""create tasks table

Revision ID: 9fb37232bbff
Revises: 472d2f73dfd4
Create Date: 2017-10-02 16:33:12.945687

"""

# revision identifiers, used by Alembic.
revision = '9fb37232bbff'
down_revision = '472d2f73dfd4'


from alembic import op
from datetime import datetime
import sqlalchemy as sa


def upgrade():
    op.create_table(
        'refresh_tasks',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('crontab_str', sa.String(120), nullable=False),
        sa.Column('config', sa.Text, nullable=False),
        sa.Column('description', sa.String(250), nullable=True),
        sa.Column('created_on', sa.DateTime, default=datetime.now, nullable=True),
        sa.Column('changed_on', sa.DateTime, default=datetime.now, nullable=True, onupdate=datetime.now),
        sa.Column('created_by_fk', sa.Integer(), sa.ForeignKey("ab_user.id"), nullable=True),
        sa.Column('changed_by_fk', sa.Integer(), sa.ForeignKey("ab_user.id"), nullable=True),
    )


def downgrade():
    op.drop_table('refresh_tasks')
