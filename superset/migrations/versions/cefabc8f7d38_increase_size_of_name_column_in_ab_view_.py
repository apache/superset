"""Increase size of name column in ab_view_menu

Revision ID: cefabc8f7d38
Revises: 6c7537a6004a
Create Date: 2018-12-13 15:38:36.772750

"""

# revision identifiers, used by Alembic.
revision = 'cefabc8f7d38'
down_revision = '6c7537a6004a'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.alter_column(
        'ab_view_menu',
        'name',
        existing_type=sa.String(length=100),
        existing_nullable=False,
        type_=sa.String(length=255),
        nullable=False)


def downgrade():
    op.alter_column(
        'ab_view_menu',
        'name',
        existing_type=sa.String(length=255),
        existing_nullable=False,
        type_=sa.String(length=100),
        nullable=False)
