"""Removing Druid coordinator from cluster conf

Revision ID: c48871eed6ca
Revises: afb7730f6a9c
Create Date: 2018-06-13 08:26:26.362939

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = 'c48871eed6ca'
down_revision = 'afb7730f6a9c'


def upgrade():
    with op.batch_alter_table('clusters') as bop:
        bop.drop_column('coordinator_endpoint')
        bop.drop_column('coordinator_host')
        bop.drop_column('coordinator_port')


def downgrade():
    with op.batch_alter_table('clusters') as bop:
        bop.add_column(
            sa.Column(
                'coordinator_port',
                mysql.INTEGER(display_width=11),
                autoincrement=False, nullable=True,
            )
        )
        bop.add_column(
            sa.Column(
                'coordinator_host',
                mysql.VARCHAR(length=255),
                nullable=True,
            ),
        )
        bop.add_column(
            sa.Column(
                'coordinator_endpoint',
                mysql.VARCHAR(length=255), nullable=True,
            )
        )
