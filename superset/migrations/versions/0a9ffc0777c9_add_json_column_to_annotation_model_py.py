"""add_json_column_to_annotation_model.py

Revision ID: 0a9ffc0777c9
Revises: 1a1d627ebd8e
Create Date: 2018-08-27 14:02:00.101734

"""

# revision identifiers, used by Alembic.
revision = '0a9ffc0777c9'
down_revision = '1a1d627ebd8e'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('annotation', sa.Column('annotation_metadata', sa.JSON(), nullable=True))
