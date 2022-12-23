"""add_msg_content_to_report_schedule

Revises: 291f024254b5
Revision ID: b060a1b53a06
Author: Burhanuddin Bhopalwala
Create Date: 2022-12-23 21:25:43.463243

"""

# revision identifiers, used by Alembic.
revision = "b060a1b53a06"
down_revision = "291f024254b5"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.add_column("report_schedule", sa.Column("msg_content", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("report_schedule", "msg_content")
    # ### end Alembic commands ###
