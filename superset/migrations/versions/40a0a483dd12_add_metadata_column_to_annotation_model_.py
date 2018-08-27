"""add_metadata_column_to_annotation_model.py

Revision ID: 40a0a483dd12
Revises: 1a1d627ebd8e
Create Date: 2018-08-27 14:25:28.079119

"""

# revision identifiers, used by Alembic.
revision = '40a0a483dd12'
down_revision = '1a1d627ebd8e'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('annotation', sa.Column('annotation_metadata', sa.Text(), nullable=True))
